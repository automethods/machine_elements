// Display policy only: calculations and stored SI values retain full precision.
export const DISPLAY_SIGNIFICANT_DIGITS=5;
export const roundDisplay=value=>Number.isFinite(value)&&value!==0?Number(value.toPrecision(DISPLAY_SIGNIFICANT_DIGITS)):value;
export const inputNumber=value=>String(roundDisplay(value));
export const formatNumber=value=>Number.isFinite(value)?new Intl.NumberFormat('uk-UA',{maximumSignificantDigits:DISPLAY_SIGNIFICANT_DIGITS}).format(value):'—';
export const texNumber=value=>{const [base,exp]=roundDisplay(value).toString().split('e');return base.replace('.','{,}')+(exp?'\\cdot10^{'+Number(exp)+'}':'');};
