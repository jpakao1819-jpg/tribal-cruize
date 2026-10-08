/* Tribal Cruize — designer.js (thin hook)
 *
 * The old flat-mockup / AI-artwork / placement / export system that used to
 * live here was removed. The active designer is now clothing-library.js, which
 * owns the Clothing Library, the photo → reconstruct → register flow, the
 * registration form + confirmation, and the working-design tools (generate /
 * upload / placement / colors / export / save) when you design from a registered
 * garment.
 *
 * This file is kept as a thin, valid hook so the <script src="designer.js"> tag
 * in designer.html doesn't 404, and so mannequin.js's leftover flat→3D toggle
 * path (which still reads window.__tcDesign.garment().name) can't throw.
 */
(function () {
  "use strict";

  const $ = (id) => (document.getElementById(id) || {});

  window.__tcDesign = {
    exportPNG: function () { return Promise.resolve(); },
    generate: function () { /* delegated to clothing-library.js */ },
    state: function () {
      return {
        garment: "tshirt",
        colors: {},
        art: null,
        style: "Tribal",
        name: "",
      };
    },
    colors: function () { return {}; },
    garment: function () {
      return {
        id: "tshirt",
        name: "T-Shirt",
        viewBox: "0 0 600 640",
        parts: [],
        paths: [],
      };
    },
  };
})();
