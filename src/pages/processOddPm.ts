import * as fs from 'fs';
import {JSDOM} from "jsdom";
import pkg from 'fontoxpath';
const {evaluateXPathToBoolean} = pkg;
import CETEI from 'CETEIcean';
import serialize from "w3c-xmlserializer";
import { BEHAVIOR_CSS_MAP } from "./behaviorsCSSMap";

// reading in the XML file and processing it
export class ProcessOddPm {

  oddDom: JSDOM;
  teiDom: JSDOM | null;
  doc: Document;
  c : any;

  generatedCSS: string = "";
  buildTimeBehaviorMap: Record<string, string> = {};

  constructor(){
    this.oddDom = new JSDOM(fs.readFileSync('/Users/nola/Code/mith/tei-pages/src/pages/basicPM.odd', 'utf-8'), {contentType: "text/xml"});
    this.doc = this.oddDom.window.document;
    this.generatedCSS = ""; 
    this.teiDom = null; 
    this.c = null
  }

  // Extract elementSpec and their respective models to get the behaviours and generate respective simple CSS that doesn't require js fpr functionality to ne implemented.
  processElSpecs() {
    // Have to add further behaviours to complexBehaviors method after link behaviour is finished. Similar pattern will be followed 
    // and those particular behaviours will be removed from this method.
    const elSpecs = this.doc.querySelectorAll("elementSpec");
    elSpecs.forEach(el => {
      const id = el.getAttribute("ident")!;
      // an elementSpec can have multiple models
      let models = el.querySelectorAll('model');
      models.forEach(model => {
        let predicate = model.getAttribute("predicate");
        let attClass = model.getAttribute("cssClass");
        let applicable = true;
        if (predicate){
          applicable = evaluateXPathToBoolean(predicate, el, null, {}, {});
        }
        if (applicable){
          const behaviour = model.getAttribute("behaviour")
          let behaviourCSS = "";
          if (behaviour) {
            behaviourCSS = BEHAVIOR_CSS_MAP[behaviour] || "";
          }
          
          // if the model has outputRendition(there can be multiple), add the direct CSS to the generated CSS. It looks like this:
          // <model behaviour="inline">
          //    <outputRendition>font-style: italic;</outputRendition>
          //  </model>

          let outputRenditions = model.querySelectorAll('outputRendition');
          let outputRenditionCSS = '';
          outputRenditions.forEach(outputRendition => {
            // console.log("i am an output rendition")
            outputRenditionCSS += `${outputRendition.textContent}\n`;
          });
          if (attClass){
            // console.log("I am here inside the final if condition");
            this.generatedCSS += `tei-${id}, .${attClass} {\n ${behaviourCSS} ${outputRenditionCSS}}\n`;
          }
          this.generatedCSS += `tei-${id} {\n ${behaviourCSS} ${outputRenditionCSS}}\n`;
        }
      });
    });
    // console.log(`This is the generate CSS being sent from my processOddPm.ts file\n ${this.generatedCSS}`);
    return this.generatedCSS;
  }


  complexBehaviors(teiString : string) {
    // Create a minimal JSDOM for CETEIcean
    const teiDom = new JSDOM(teiString, { contentType: "text/xml" }).window.document;
    // Set global variables so CETEIcean can work server-side
    (global as any).document = teiDom;

    this.c = new CETEI({ documentObject: teiDom, omitDefaultBehaviors : true});

    // read in ODD
    // determine elements with behavior="link"
    // traverse TEI data, find elements from previous steps
    // build behavior object and add entries for those elements with the serialized corresponding function.
    let cbehaviors:any = {
      "namespaces": {
        "tei": "http://www.tei-c.org/ns/1.0",
        "teieg": "http://www.tei-c.org/ns/Examples",
      },
      "tei": {}
    }

    const models = this.doc.querySelectorAll("model");
    for (let i = 0; i < models.length; i++) {
      const model = models[i];
      const behaviour = model.getAttribute("behaviour");
      const elSpec = model.parentNode as Element;
      const id = elSpec.getAttribute("ident")!;
      if (behaviour && id) {
        if (behaviour === "link") {
          cbehaviors["tei"][id] = function linkFn(elt: Element) {
            console.log("This is the element whose behaviour is getting added", elt);
            const link = document.createElement("a");
            const target =  elt.getAttribute("target")|| "#";
            link.setAttribute("href", target);
            link.textContent = elt.textContent || target;
            return link;
          }
        }
      }
    }
    this.c.addBehaviors(cbehaviors);
    const html5Dom = this.c.domToHTML5(teiDom, undefined, null);
    return serialize(html5Dom);
  }

  supportClass(teiFile: string) {
    // These are the models in the ODD file  
    const models = this.doc.querySelectorAll("model");

    // Getting the tei file for formatting
    const fileTEI = new JSDOM(teiFile, { contentType: "text/xml" });
    const TEIDoc = fileTEI.window.document;

    // Using the default namespace to create a namespace resolver function for evaluateXPathToBoolean (Don't have functionality for
    // multiple/non-default namespaces yet)
    const NS = TEIDoc.documentElement.namespaceURI;
    function namespaceResolver(): string | null {
      return NS || null;
    }
    // For all models in the ODD file, if predicate is satisfied and class attribute is present, add class to the target elements in the TEI file
    for (let i = 0; i < models.length; i++) {
      const model = models[i];
      const predicate = model.getAttribute("predicate");
      const className = model.getAttribute("cssClass");
      const elSpec = model.parentNode as Element;
      const id = elSpec.getAttribute("ident")!;
      const targetNodes = TEIDoc.getElementsByTagNameNS(NS, id);
     
      if (className && predicate) {
        for (const node of targetNodes) {
            const shouldApply = evaluateXPathToBoolean(predicate, node, null, namespaceResolver);
            // console.log("Predicate:", predicate, "on node:", node, "evaluated to:", shouldApply);
            // Only apply class if predicate passes
            if (shouldApply) {
              node.setAttribute("class", ((node.getAttribute("class") || "") + " " + className).trim());
            }
        }
      }
      // If there is no predicate, apply the class to all target nodes. 
      else {
        Array.from(targetNodes).forEach(elt => {
          elt.setAttribute(
            "class",(elt.getAttribute("class") || "") + " " + className
          );
        });
      }
    }
    return serialize(TEIDoc);
  }
}