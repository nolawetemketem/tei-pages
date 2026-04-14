import {JSDOM} from "jsdom";
import pkg from 'fontoxpath';
const {evaluateXPathToBoolean} = pkg;
import CETEI from 'CETEIcean';
import serialize from "w3c-xmlserializer";
import { BEHAVIOR_CSS_MAP } from "./behaviorsCSSMap";


// Processes given TEI-XML documents with respect to given processing model 'oddPM'.

export class ProcessOddPM {


  oddDom: JSDOM;
  doc: Document;
  cetei : any;
  css: string = "";
  oddModels: NodeListOf<Element>;


  constructor(oddPM : string) {
    this.oddDom = new JSDOM(oddPM, {contentType: "text/xml"});
    this.doc = this.oddDom.window.document;
    this.cetei = null
    this.css = ""; 
    this.oddModels = this.doc.querySelectorAll("model");


  // Extracts behaviours from elementSpec and their models  
  // Generates respective CSS from BEHAVIOR_CSS_MAP that doesn't require js 

    const elSpecs = this.doc.querySelectorAll("elementSpec");

    elSpecs.forEach(el => { 
      const id = el.getAttribute("ident")!;
      let elSpecModels = el.querySelectorAll('model');

      // an elementSpec can have multiple models
      elSpecModels.forEach(model => {
        let predicate = model.getAttribute("predicate");
        let cssClass = model.getAttribute("cssClass");
        let applicable = true;

        if (predicate) {
          applicable = evaluateXPathToBoolean(predicate, el, null, {}, {});
        }
        if (applicable) {
          const behaviour = model.getAttribute("behaviour");
          let behaviourCSS = (behaviour) ? BEHAVIOR_CSS_MAP[behaviour] || "" : "";
          let outputRenditions = model.querySelectorAll('outputRendition');
          let outputRenditionCSS = '';

          // if the model has outputRendition(s), add it's respective CSS 
          outputRenditions.forEach(outputRendition => {
            outputRenditionCSS += `${outputRendition.textContent}\n`;
          });

          if (cssClass){
            this.css += `tei-${id}, .${cssClass} {\n ${behaviourCSS} ${outputRenditionCSS}}\n`;
          }
          this.css += `tei-${id} {\n ${behaviourCSS} ${outputRenditionCSS}}\n`;
        }
      });
    });
  }


  // Get CSS is generated based on the behaviors and output renditions 
  // only includes styles that don't require JS for complex behaviors.

  getCSS() {
    return this.css;
  }


  // Associates CSS with TEI elements, with respect to processing model
  // Returns the processed TEI as a string.

  applyCSS(teiFile: string) {

    // Getting the tei file for formatting
    const teiXML = new JSDOM(teiFile, { contentType: "text/xml" });
    const teiDoc = teiXML.window.document;

    // Using the default namespace to create a namespace resolver function for evaluateXPathToBoolean (Don't have functionality for
    // multiple/non-default namespaces yet)
    const NS = teiDoc.documentElement.namespaceURI;
    function namespaceResolver(): string | null {
      return NS || null;
    }
    
    // For all models in the ODD file, if predicate is satisfied and class attribute is present, add class to the target elements in the TEI file
    for (let i = 0; i < this.oddModels.length; i++) {
      const model = this.oddModels[i];
      const predicate = model.getAttribute("predicate");
      const cssClass = model.getAttribute("cssClass");
      const elSpec = model.parentNode as Element;
      const id = elSpec.getAttribute("ident")!;
      const targetNodes = teiDoc.getElementsByTagNameNS(NS, id);
     
      if (cssClass && predicate) {
        for (const node of targetNodes) {
          const shouldApply = evaluateXPathToBoolean(predicate, node, null, namespaceResolver);
          // console.log("Predicate:", predicate, "on node:", node, "evaluated to:", shouldApply);
          // Only apply class if predicate passes
          if (shouldApply) {
            node.setAttribute("class", ((node.getAttribute("class") || "") + " " + cssClass).trim());
          }
        } 
      } else { // If there is no predicate, apply the class to all target nodes. 
        Array.from(targetNodes).forEach( elt => {
          elt.setAttribute("class",(elt.getAttribute("class") || "") + " " + cssClass);
        });
      }
    }

    // Mark alternate child elements for the Alternate behavior component
    // Children of choice elements get marked with data-alternate-child attribute
    // const choiceElements = teiDoc.getElementsByTagNameNS(NS, "choice");
    // Array.from(choiceElements).forEach((choice) => {
    //   Array.from(choice.children).forEach((child) => {
    //     const childName = child.localName || child.nodeName.toLowerCase();
    //     child.setAttribute("data-alternate-child", childName);
    //   });
    // });

    return serialize(teiDoc);
  }



// Uses CETEIcean to apply behaviors specified in the ODD file to the TEI document. 
// Returns processed TEI as a string.

applyCETEI(teiString : string) {

    // minimal JSDOM and vars to use CETEIcean server-side
    const teiDom = new JSDOM(teiString, { contentType: "text/xml" }).window.document;
    (global as any).document = teiDom;
    this.cetei = new CETEI({ documentObject: teiDom, omitDefaultBehaviors : true})
    let cBehaviors :any = {
      "namespaces": {
        "tei": "http://www.tei-c.org/ns/1.0",
        "teieg": "http://www.tei-c.org/ns/Examples",
      },
      "tei": {}
    }

    for (let i = 0; i < this.oddModels.length; i++) {
      const model = this.oddModels[i];
      const behaviour = model.getAttribute("behaviour");
      const elSpec = model.parentNode as Element;
      const id = elSpec.getAttribute("ident")!;
      
      if (behaviour && id) {
        if (behaviour === "link") {
          cBehaviors["tei"][id] = (elt: Element) => {
            const link = document.createElement("a");
            const target =  elt.getAttribute("target")|| "#";
            link.setAttribute("href", target);
            link.textContent = elt.textContent || target;
            return link;
          }
        }
      }
    }
    this.cetei.addBehaviors(cBehaviors);
    return serialize(this.cetei.domToHTML5(teiDom, undefined, null));
  }

  // Extract client-side behavior configurations from ODD file
  // Analyzes the ODD to determine which behaviors are needed and their configuration
  // Returns a mapping of behaviors to their configurations
  
  getClientBehaviors(): Record<string, any[]>{
    const clientBehaviorsMap: Record<string, any[]> = {};
    const allElementSpecs = new Map();
    // First pass: collect all element specs for reference
    this.doc.querySelectorAll("elementSpec").forEach((spec) => {
      const ident = spec.getAttribute("ident")!;
      allElementSpecs.set(ident, spec);
    });
    // Analyze models for client behaviors
    this.oddModels.forEach((model) => {

      const behavior = model.getAttribute("behaviour");
      const elSpec = model.parentNode as Element;
      const id = elSpec.getAttribute("ident")!;
      const predicate = model.getAttribute("predicate");

      if (behavior === "alternate") {
        if (!clientBehaviorsMap["alternate"]) {
          clientBehaviorsMap["alternate"] = [];
        }
        // Extract predicate ("sic and corr" -> ["sic", "corr"])
        // let predicateEl : string [] = [];
        // if (predicate) {
        //   // Match element names in predicate like "sic and corr" or "abbr and expan"
        //   const matches = predicate.match(/\b([a-z]+)\b/g);
        //   if (matches) {
        //     predicateElements = matches.filter(name => name !== "and"); // Filter out logical operators
        //   }
        // }
        // get default and alternate from param elements
        let defaultChoice: string | null = null,  altChoice: string | null = null;
        model.querySelectorAll("param").forEach((param) => {
          const name = param.getAttribute("name"), value = param.getAttribute("value");
          if (value) { // Extract element name from xpath-like syntax (e.g., "corr[1]" -> "corr")
            const choiceEl = value.match(/^([a-z]+)/)?.[1];
            if(choiceEl) {
              if (name === "default") {
                defaultChoice = choiceEl;
              } else if (name === "alternate") {
                altChoice = choiceEl;
              }
            }
          }
          // Build  array from extracted options
          if (defaultChoice && altChoice) {
            clientBehaviorsMap["alternate"].push({
              name: `alternate ${id}: ${predicate}`,
              parent: id,
              default: defaultChoice,
              alternate: altChoice,
            });
          }
        });
      }

      
    });
    return clientBehaviorsMap;
  }
}
