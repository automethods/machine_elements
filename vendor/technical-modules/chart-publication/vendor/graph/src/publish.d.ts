import type {TechnicalProfile,TechnicalBinding,TechnicalGraph,TechnicalNativeState,PropertyCheck} from './technical.js';
import type {PlotlyRuntime} from './core.js';
export interface PublicationRuntime extends PlotlyRuntime {newPlot:Function;toImage:Function;purge:Function}
export interface PublicationReport {schema:string;version:string;representation:'vector'|'raster';outcome:'accepted'|'failed';checks:PropertyCheck[];artifactDigest?:string;liveState?:string;[key:string]:unknown}
export interface SVGPublication {svg:string;report:PublicationReport}
export interface PNGPublication {bytes:Uint8Array;report:PublicationReport}
export function captionSVG(p:TechnicalProfile,unitsPerMm?:number):SVGSVGElement;
export function inspectCaptionGeometry(p:TechnicalProfile):PropertyCheck[];
export function snapshotNativeForPublication(g:TechnicalGraph):TechnicalNativeState;
export function inspectTechnicalSVG(svg:string,p:TechnicalProfile,bindings:TechnicalBinding[],data:any[]):Promise<PublicationReport>;
export function publishTechnicalSVG(Plotly:PublicationRuntime,graph:TechnicalGraph,p:TechnicalProfile,bindings?:TechnicalBinding[],options?:{strict?:boolean}):Promise<SVGPublication>;
export function publishTechnicalPNG(Plotly:PublicationRuntime,graph:TechnicalGraph,p:TechnicalProfile,bindings?:TechnicalBinding[],options?:{strict?:boolean}):Promise<PNGPublication>;
export function makeTechnicalHTML(native:TechnicalNativeState,p:TechnicalProfile,bindings:TechnicalBinding[],runtime:string,technicalRuntime:string):string;
export function makePrintHTML(svgOrURL:string,p:TechnicalProfile,representation?:'vector'|'raster'):string;
export function crc32(bytes:Uint8Array):number;
export function withPNGResolution(bytes:Uint8Array|ArrayBuffer,dpi:number):Uint8Array;
export function readPNGGeometry(bytes:Uint8Array|ArrayBuffer):{width:number;height:number;x_ppm?:number;y_ppm?:number;unit?:number};
