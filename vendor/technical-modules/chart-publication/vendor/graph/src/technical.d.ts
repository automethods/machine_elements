import type {ExclusiveRunner, ChannelKind, PlotlyRuntime} from './core.js';
export const TECHNICAL_VERSION:'0.4.1';
export const CSS_PX_PER_MM:number, SVG_UNITS_PER_MM:number;
export type LineRole='primary'|'secondary'|'reference'|'limit'|'construction'|'centerline'|'uncertainty'|'axis'|'grid_major'|'grid_minor';
export type Marker='native'|'none'|'circle'|'circle-open'|'square'|'square-open'|'triangle-up'|'triangle-down'|'diamond'|'cross'|'x';
export interface LineToken {width_mm:number;color:string;dash_mm:number[];dash_offset_mm:number;cap:'butt'|'round'|'square';join:'round'|'miter'|'bevel';marker:Marker;marker_mm:number;marker_edge_mm:number;max_markers:number}
export interface Quantity {quantity:string;symbol:string;unit:string}
export interface TechnicalProfile {
 schema:'graph-technical-profile/0.4';name:string;mode:'technical_format'|'native_style';
 page:{width_mm:number;height_mm:number;left_mm:number;right_mm:number;top_mm:number;bottom_mm:number;caption_mm:number;dpi:96|150|300|600};
 typography:{family:'Arial'|'Times New Roman'|'Georgia'|'Verdana'|'Courier New';size_mm:number;cap_height_mm:number|null;text_policy:'external_font_required'};
 background:string;foreground:string;grid:{major:boolean;minor:boolean};
 axes:{ticks:'outside'|'inside'|'';tick_length_mm:number;minor_tick_length_mm:number;ends:'plain'|'arrows';arrow_mm:number;label_position:'center'|'end'|'arrowhead';notation:'comma'|'slash'|'brackets'|'quantity';labels:boolean;steps:Record<'x'|'y'|'z',{major:number|null;minor:number|null}>};
 legend:'native'|'top'|'bottom'|'right'|'hidden';roles:Record<LineRole,LineToken>;
 caption:{enabled:boolean;number:string;title:string;source:string;notes:string;prefix:string};
 metadata:Record<'x'|'y'|'z',Quantity>;provenance:string;
}
export const LINE_ROLES:LineRole[], MARKERS:Marker[];
export const MARKER_FACTORS:Partial<Record<Marker,number>>;
export const DASH_PATTERNS:Record<string,number[]>;
export const technicalProfiles:Readonly<Record<'ua'|'colour'|'monochrome',TechnicalProfile>>;
export interface TechnicalBinding {index:number;role:LineRole;channels?:Partial<Record<'color'|'width'|'dash'|'marker',ChannelKind>>}
// Native Plotly objects are foreign-library values. This boundary intentionally
// does not replace Plotly's own trace/layout typings; runtime checks enforce scope.
export interface TechnicalNativeState {data:any[];layout:any;host?:unknown;revision?:string|null}
export interface TechnicalGraph extends TechnicalNativeState {querySelectorAll?:Function;on?:Function;removeListener?:Function}
export interface TechnicalOperation {target:'layout'|'trace';index?:number;path:string;previous:{present:boolean;value?:unknown};next:unknown;token:string;remove?:boolean}
export interface TechnicalDimensions {width_mm:number;height_mm:number;chart_height_mm:number;caption_mm:number;plot:{x_mm:number;y_mm:number;width_mm:number;height_mm:number};raster:{width:number;height:number;dpi:number}}
export interface TechnicalPlan {schema?:string;version?:string;profile:TechnicalProfile;pxPerMm?:number;operations:TechnicalOperation[];notices:string[];dimensions?:TechnicalDimensions;baseDigest?:string}
export interface PropertyCheck {property:string;status:'verified'|'nominal'|'unsupported'|'failed';requested?:unknown;measured?:unknown;required?:boolean;unit?:string;deviation?:number;tolerance?:number;method?:string;reason?:string;[key:string]:unknown}
export interface TechnicalReport {schema:string;version:string;engine:string;outcome:'accepted'|'failed';operationCount:number;checks:PropertyCheck[];recovery:string;notices:string[];beforeDigest:string;afterDigest:string;profile:TechnicalProfile;styleMismatches:unknown[]}
export interface TechnicalResult {plan:TechnicalPlan;report:TechnicalReport}
export interface TechnicalOptions {withExclusive:ExclusiveRunner;bindings?:TechnicalBinding[];allowUntestedVersion?:boolean;pxPerMm?:number;fontSizePx?:number;readProtectedState?:()=>unknown|Promise<unknown>;readRevision?:()=>string|Promise<string>;awaitSettled?:()=>void|Promise<void>}
export interface TechnicalAdapter {plan(p:TechnicalProfile):Promise<TechnicalPlan>;apply(p:TechnicalPlan):Promise<TechnicalResult>;applyProfile(p:TechnicalProfile):Promise<TechnicalResult>;capture():Promise<TechnicalNativeState>;readonly canUndo:boolean;readonly profile:TechnicalProfile|null;undo():Promise<TechnicalResult>;dispose():void}
export function cloneTechnical<T>(v:T):T;
export function parseDashMM(v:string|number[]):number[];
export function validateTechnicalProfile(v:unknown):TechnicalProfile;
export function technicalDimensions(p:TechnicalProfile):TechnicalDimensions;
export function quantityLabel(m:Quantity,notation?:TechnicalProfile['axes']['notation']):string;
export function profileWarnings(p:TechnicalProfile,is3d?:boolean):string[];
export function planTechnicalStyle(state:TechnicalNativeState,p:TechnicalProfile,b?:TechnicalBinding[],options?:{pxPerMm?:number;fontSizePx?:number}):TechnicalPlan;
export function applyTechnicalOperationsToCopy(state:TechnicalNativeState,ops:TechnicalOperation[]):TechnicalNativeState;
export function createTechnicalAdapter(Plotly:PlotlyRuntime,graph:TechnicalGraph,options:TechnicalOptions):TechnicalAdapter;
export function finishTechnicalSVG(root:ParentNode,data:any[],p:TechnicalProfile,bindings:TechnicalBinding[],pxPerMm:number):void;
export function resolveTechnicalFontPx(p:TechnicalProfile,pxPerMm?:number):number;
