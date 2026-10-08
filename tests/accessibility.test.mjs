import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const tokens = selector => Object.fromEntries([...css.matchAll(selector)].flatMap(match =>
  [...match[1].matchAll(/(--[\w-]+):\s*(#[\da-f]+)/gi)].map(([,key,value])=>[key,value])));
const light = tokens(/:root\s*\{([^}]+)\}/g);
const dark = {...light,...tokens(/\[data-theme="dark"\]\s*\{([^}]+)\}/g)};
const luminance = hex => {
  let digits = hex.slice(1);
  if(digits.length===3) digits=[...digits].map(c=>c+c).join('');
  const rgb = digits.match(/../g).map(c=>parseInt(c,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);
  return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
};
const contrast = (a,b) => (Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
for(const [name,palette] of [['light',light],['dark',dark]]) {
  test(`${name}: normal-sized text keeps at least 4.5:1 contrast in semantic surfaces`,()=>{
    const pairs=[['ink','canvas'],['ink','paper'],['muted','canvas'],['muted','paper'],['muted','soft'],['accent','tint'],['accent','paper'],['danger','danger-soft'],['success','paper'],['on-success','success'],['on-action','action'],['hero-text','hero-bg'],['hero-muted','hero-bg']];
    for(const [fg,bg] of pairs) {
      const ratio=contrast(palette[`--${fg}`],palette[`--${bg}`]);
      assert.ok(ratio>=4.5,`${name} ${fg}/${bg}: ${ratio.toFixed(2)}:1`);
    }
  });
  test(`${name}: form boundaries keep at least 3:1 contrast`,()=>{
    for(const bg of ['paper','canvas','soft']) assert.ok(contrast(palette['--control-line'],palette[`--${bg}`])>=3, bg);
  });
}
