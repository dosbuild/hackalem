/** One material vocabulary for geometry, shaders and the interface. Values are sRGB. */
export const PALETTE = Object.freeze({
  felt:'#eee5d0', paper:'#f5f5ed', ink:'#283c40', muted:'#536970',
  sage:'#8d9d87', water:'#65958d', clay:'#b8735d', brass:'#bc9854',
  indigo:'#62758a', textile:'#8b514e', pine:'#536f61', line:'#c1ccc4',
  land:'#d8ccb0', landEdge:'#887f6c', landRim:'#c5b696',
  skyTop:'#c6d5cd', skyBottom:'#f0e5cd', nightTop:'#273d43', nightBottom:'#697c77',
  stone:'#e3dbc5', paving:'#d2c8b3', road:'#969d95', path:'#c9b796',
});
export const DISTRICT_PALETTE = Object.freeze({
  esil:'#91aaa1', almaty:'#ba9c8d', saryarka:'#a5ae8d', baikonur:'#a0a3b3', nura:'#bcb08b',
});
export const unitColor = hex => hex.replace('#','').match(/../g).map(value=>parseInt(value,16)/255);
export function applyPalette(element) {
  for (const [name,color] of Object.entries(PALETTE)) element.style.setProperty(`--${name.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())}`,color);
}
