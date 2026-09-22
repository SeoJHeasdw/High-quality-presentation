import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import CinematicField, { type FieldScene } from "./CinematicField";
import ClickSpark from "../reactbits/ClickSpark/ClickSpark";
import { usePerformanceMotion } from "./usePerformanceMotion";

export const SlidePosition = createContext<{index:number;total:number}|null>(null);
export function Frame({children,n,name,scene,className="",step=0}:{children:ReactNode;n:number;name:string;scene?:FieldScene;className?:string;step?:number}){
 const position=useContext(SlidePosition),number=position?position.index+1:n,total=position?.total??22;
 const interactive=usePerformanceMotion() && !className.includes("kn-cover") && (number<18 || number>22);
 return <section className={`kn-slide ${className}`} data-slide={number} data-step={step} data-scene={scene} data-course-motion="custom" aria-label={`${number}. ${name}`}>
  {scene&&<CinematicField scene={scene}/>}
  <header className="kn-chrome"><span>TEL <i>/</i> JAVIS</span><span>TECHNOLOGY EXPERT LAB</span></header>
  <main className="kn-body">{children}</main>
  <footer className="kn-footer"><span>{name}</span><span>{String(number).padStart(2,"0")} <i>/ {total}</i></span></footer>
  {interactive&&<ClickSpark color={className.includes("abuse-slide")?"#76ff8b":"#bde6fa"}/>}
 </section>;
}
export function Briefing({children,n,name,title,lead,step=0,className=""}:{children:ReactNode;n:number;name:string;title:ReactNode;lead?:string;step?:number;className?:string}){
 return <Frame n={n} name={name} step={step} className={`kn-brief ${className}`}>
  <div className="brief-heading"><p className="kn-kicker">{name}</p><h1>{title}</h1>{lead&&<p className="brief-lead">{lead}</p>}</div>
  <div className="brief-content">{children}</div>
 </Frame>;
}
export function Reveal({children,order=0,on=true,className=""}:{children:ReactNode;order?:number;on?:boolean;className?:string}){
 return <div className={`kn-reveal ${className}`} data-on={on||undefined} style={{"--order":order} as CSSProperties}>{children}</div>;
}
export function Rows({items,step}:{items:[string,string][];step?:number}){
 return <div className="brief-rows">{items.map(([title,body],i)=><Reveal key={title} order={i} className="brief-row" on={step===undefined||i<=step}><span className="row-index">{String(i+1).padStart(2,"0")}</span><h2>{title}</h2><p>{body}</p></Reveal>)}</div>;
}
