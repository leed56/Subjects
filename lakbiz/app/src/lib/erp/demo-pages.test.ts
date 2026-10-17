import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe,it,expect } from "vitest";
import { DemoScreens } from "@/components/demo/demo-screens";
import { INDUSTRY_TEMPLATES, WORKSPACES } from "./industry-templates";
import { createDemoState } from "./demo-data";
describe("complete industry page coverage",()=>{
  for(const template of INDUSTRY_TEMPLATES)it(`${template.id}: every proposed workspace renders its real sample dataset`,()=>{
    const data=createDemoState(template.id,new Date("2026-10-11T03:30:00Z"));
    for(const workspace of WORKSPACES){const html=renderToStaticMarkup(createElement(DemoScreens,{workspace:workspace.id,data,template,role:"owner",search:"",run:()=>true,open:()=>{}}));expect(html.length,workspace.id).toBeGreaterThan(100);expect(html,workspace.id).not.toContain("NaN");expect(html,workspace.id).not.toContain("undefined");}
  });
  it("inventory and customers omit cost and credit for operational roles",()=>{const template=INDUSTRY_TEMPLATES[0],data=createDemoState(template.id);for(const workspace of ["inventory","customers"] as const){const html=renderToStaticMarkup(createElement(DemoScreens,{workspace,data,template,role:"cashier",search:"",run:()=>true,open:()=>{}}));expect(html).not.toContain("Unit cost");expect(html).not.toContain("Credit limit");expect(html).not.toContain("Outstanding");}});
});
