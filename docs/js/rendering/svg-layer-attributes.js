export function applyLayerAttributes(el, layer) {
  if (!layer) return;
  el.dataset.layer = layer;
  el.classList.add('layer', `layer-${layer}`);
}
