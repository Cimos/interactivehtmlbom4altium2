// drawFootprint wrapper. Adds a stronger highlight halo on top of upstream's
// draw (issue J): upstream's bbox highlight (web/render.js:322-337) is
// alpha-0.2 fill + 3-px stroke in --pad-color-highlight. On dark-green PCBs
// with sparse-silk footprints (FPCs, BGAs) the recolored silk doesn't read
// as "selected" and the bbox stroke is too thin to catch the eye. We
// re-stroke + re-fill at 0.3 alpha after upstream's draw, with stroke width
// capped at 5% of the smaller bbox dimension so it stays proportional when
// zoomed out (otherwise an 8-px stroke drowns small components).
//
// We don't edit web/render.js (vendored).
//
// A DNP/no-BOM gray-out was tried here and reverted: large mechanical parts
// marked "Standard (No BOM)" overlap smaller populated components, dulling
// them too. No easy fix without per-part-type filtering.
(function () {
  const __origDrawFootprint = drawFootprint;
  drawFootprint = function (ctx, layer, scalefactor, footprint, colors, highlight, outline) {
    __origDrawFootprint(ctx, layer, scalefactor, footprint, colors, highlight, outline);
    if (highlight && footprint.layer == layer) {
      ctx.save();
      ctx.translate(...footprint.bbox.pos);
      ctx.rotate(deg2rad(-footprint.bbox.angle));
      ctx.translate(...footprint.bbox.relpos);
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = colors.pad;
      ctx.fillRect(0, 0, ...footprint.bbox.size);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = colors.pad;
      ctx.lineWidth = Math.min(
        8 / scalefactor,
        Math.min(footprint.bbox.size[0], footprint.bbox.size[1]) * 0.05
      );
      ctx.strokeRect(0, 0, ...footprint.bbox.size);
      ctx.restore();
    }
  };
})();
