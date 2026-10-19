export const VERSION: '0.3.0';
export const TESTED_PLOTLY_VERSION: '3.3.1';
export type ChannelKind = 'decorative' | 'quantitative' | 'categorical' | 'unknown';
export type Role = 'primary' | 'secondary' | 'reference' | 'limit' | 'construction';
export interface Profile {name?: string; fontFamily?: 'Arial'|'Georgia'|'Verdana'|'Courier New';fontSize?:number;foreground?:string;background?:string;plotBackground?:string;gridColor?:string;gridWidth?:number;showGrid?:boolean;lineWidth?:number;colors?:Partial<Record<Role,string>>}
export const profiles: Readonly<Record<'technical'|'monochrome'|'midnight', Readonly<Profile>>>;
export class AdapterError extends Error {code:string;details:unknown;constructor(code:string,message:string,details?:unknown)}
export type ExclusiveRunner = <T>(operation:()=>Promise<T>)=>Promise<T>;
export function createExclusiveRunner(): ExclusiveRunner;
export function canonical(value:unknown):string;
export function sha256(text:string):Promise<string>;
export function sha256Portable(text:string):string;
export function validateProfile(profile:Profile):Readonly<Profile>;
export interface Binding {index:number;role:Role;channels?:Partial<Record<'color'|'width',ChannelKind>>}
export interface AdapterOptions {withExclusive:ExclusiveRunner;bindings?:Binding[];allowUntestedVersion?:boolean;readProtectedState?:()=>unknown|Promise<unknown>;readRevision?:()=>string|Promise<string>;awaitSettled?:()=>void|Promise<void>}
export interface NativeGraph {data: object[]; layout: object}
export interface PlotlyRuntime {version:string;relayout:Function;restyle:Function}
export interface PatchOperation {target:'layout'|'trace';index?:number;path:string;previous:{present:false}|{present:true,value:unknown};next:unknown;token:string;restoreAbsence?:boolean}
export interface StylePlan {readonly id:string;readonly adapterVersion:string;readonly engineVersion:string;readonly baseDigest:string;readonly operations:readonly PatchOperation[];readonly notices:readonly string[]}
export interface Check {property:string;status:'verified'|'failed'|'not_evaluated';method:string}
export interface Report {schema:'graph-adaptation-report/0.3';adapterVersion:string;engine:{name:'plotlyjs';version:string};planId:string;outcome:'accepted'|'failed';operationCount:number;recovery:'not_needed'|'restored'|'recovery_required'|'conflict';checks:readonly Check[];beforeDigest:string;afterDigest:string;limitations:readonly string[];error?:string}
export interface RunResult {plan:StylePlan;report:Report}
export interface NativeState {data:object[];layout:object;host:unknown;revision:string|null}
export interface Adapter {plan(profile:Profile):Promise<StylePlan>;apply(plan:StylePlan):Promise<Report>;applyProfile(profile:Profile):Promise<RunResult>;undo():Promise<RunResult>;capture():Promise<NativeState>;readonly canUndo:boolean;dispose():void}
export function createPlotlyAdapter(runtime:PlotlyRuntime,graph:NativeGraph,options:AdapterOptions):Adapter;
export function safeJSON(value:unknown):string;
export interface NativeFigure {data:object[];layout?:object;config?:object;metadata?:object}
export function validateFigureInput(input:unknown):NativeFigure;
export function makeStandaloneHTML(figure:NativeFigure,runtimeSource:string,metadata?:unknown):string;
