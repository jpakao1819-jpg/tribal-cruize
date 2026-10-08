/* Tribal Cruize — Image → STL (heightfield from a photo)
 *
 * Converts an uploaded garment photo into a real 3D model as a binary STL.
 * The photo is decoded on an offscreen canvas; its luminance becomes a
 * heightfield (brighter = higher). The result is an extruded relief with a
 * thin base plate so it comes out as one solid-ish block (not a floating mesh).
 *
 * This is a heightfield/emboss interpretation of the photo — it looks like the
 * picture in 3D — NOT a true multi-view garment reconstruction. The real
 * garment reconstruction is the reconstructFromPhotos() integration point that
 * produces the garment_3d sections/UV/materials metadata. Image → STL is the
 * quick way to get a real downloadable 3D model straight from a single photo.
 *
 * Defaults (mm scale): treat the photo's smaller dimension as 200 mm; relief
 * depth = 12% of that; base plate = 2% of that; grid ~192 cells across the
 * larger dimension (target under ~1 MB STL). Tweak opts below.
 */

(function () {
  "use strict";

  // ----------------------------------------------------------------------------
  //  Decode a data URL (or any image src) onto an offscreen canvas, fully.
  // ----------------------------------------------------------------------------

  function loadImageFully(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not decode image for STL"));
      img.src = dataUrl;
    });
  }

  function toCanvas(img, w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    return { c, ctx };
  }

  function luminanceGrid(img, cellsX, cellsY) {
    const { c, ctx } = toCanvas(img, cellsX, cellsY);
    const d = ctx.getImageData(0, 0, cellsX, cellsY).data;
    const grid = new Float32Array(cellsX * cellsY);
    for (let i = 0; i < cellsX * cellsY; i++) {
      const p = i * 4;
      grid[i] =
        (0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2]) / 255;
    }
    return grid;
  }

  // ----------------------------------------------------------------------------
  //  Build a triangulated heightfield mesh (extruded relief + base plate).
  // ----------------------------------------------------------------------------

  function buildHeightfieldMesh(lum, cellsX, cellsY, opts) {
    opts = opts || {};
    const mmPerUnitMin = opts.mmPerUnitMin || 200; // source small dim -> this many mm
    const reliefDepthRatio = opts.reliefDepthRatio || 0.12;
    const basePlateRatio = opts.basePlateRatio || 0.02;

    const wPx = cellsX; // one sample per grid cell (we already downsampled)
    const hPx = cellsY;
    // We treat each grid sample as a "pixel"; the source image small dim maps to
    // mmPerUnitMin mm. So 1 source-pixel = (mmPerUnitMin / smallDimPx) mm.
    // smallDimPx here is min(cellsX, cellsY) because we sampled at cellsX x cellsY.
    const smallPx = Math.min(cellsX, cellsY);
    const scaleMM = mmPerUnitMin / smallPx;

    const wMM = cellsX * scaleMM;
    const hMM = cellsY * scaleMM;
    const reliefMM = smallPx * reliefDepthRatio * scaleMM;
    const plateMM = Math.max(reliefMM * 0.25, smallPx * basePlateRatio * scaleMM);

    // Height (z) for each cell center, in mm.
    const heightMM = new Float32Array(cellsX * cellsY);
    for (let i = 0; i < cellsX * cellsY; i++) {
      heightMM[i] = plateMM + lum[i] * reliefMM;
    }

    const verts = [];
    const addV = (x, y, z) => verts.push({ x, y, z });

    // grid has (cellsX+1)*(cellsY+1) vertices. Top surface covers the full grid;
    // heights are stored per cell, so we interpolate edge heights from the nearest
    // cell (once we're off the last row/col we clamp to the last cell).

    function cellHeight(i, j) {
      // i in [0,cellsX], j in [0,cellsY]; clamp to last cell.
      const ci = Math.min(i, cellsX - 1);
      const cj = Math.min(j, cellsY - 1);
      return heightMM[cj * cellsX + ci];
    }

    for (let j = 0; j <= cellsY; j++) {
      for (let i = 0; i <= cellsX; i++) {
        const x = (i / cellsX) * wMM;
        const y = (j / cellsY) * hMM;
        const z = cellHeight(i, j);
        addV(x, y, z);
      }
    }

    const tris = [];
    function addTri(a, b, c) {
      tris.push({ a, b, c });
    }

    const idx = (i, j) => j * (cellsX + 1) + i;

    // Top surface (oriented +z).
    for (let j = 0; j < cellsY; j++) {
      for (let i = 0; i < cellsX; i++) {
        const a = idx(i, j);
        const b = idx(i + 1, j);
        const c = idx(i, j + 1);
        const d = idx(i + 1, j + 1);
        addTri(a, b, c);
        addTri(c, b, d);
      }
    }

    // Bottom plate (oriented -z) at z = 0, same grid.
    const bottomBase = verts.length;
    for (let j = 0; j <= cellsY; j++) {
      for (let i = 0; i <= cellsX; i++) {
        const x = (i / cellsX) * wMM;
        const y = (j / cellsY) * hMM;
        addV(x, y, 0);
      }
    }
    for (let j = 0; j < cellsY; j++) {
      for (let i = 0; i < cellsX; i++) {
        const a = bottomBase + idx(i, j);
        const b = bottomBase + idx(i + 1, j);
        const c = bottomBase + idx(i, j + 1);
        const d = bottomBase + idx(i + 1, j + 1);
        // -z normal: (a,c,b) and (c,d,b)
        addTri(a, c, b);
        addTri(c, d, b);
      }
    }

    // Side walls between top-edge heights and bottom z=0.
    function edgeTop(j) {
      const out = [];
      for (let i = 0; i <= cellsX; i++) out.push(idx(i, j));
      return out;
    }
    function edgeTopI(i) {
      const out = [];
      for (let j = 0; j <= cellsY; j++) out.push(idx(i, j));
      return out;
    }
    function edgeBottom(j) {
      const out = [];
      for (let i = 0; i <= cellsX; i++) out.push(bottomBase + idx(i, j));
      return out;
    }
    function edgeBottomI(i) {
      const out = [];
      for (let j = 0; j <= cellsY; j++) out.push(bottomBase + idx(i, j));
      return out;
    }

    // Front (j = 0), back (j = cellsY): run along +x; outside is -y.
    function addQuadStrip(topEdge, bottomEdge, n, outsideIsNegY) {
      for (let k = 0; k < n - 1; k++) {
        const a = topEdge[k];
        const b = topEdge[k + 1];
        const c = bottomEdge[k + 1];
        const d = bottomEdge[k];
        if (outsideIsNegY) {
          addTri(a, b, c);
          addTri(a, c, d);
        } else {
          addTri(b, a, d);
          addTri(b, d, c);
        }
      }
    }
    // Front (j=0): outside = -y. Back (j=cellsY): outside = +y.
    addQuadStrip(edgeTop(0), edgeBottom(0), cellsX + 1, true);
    addQuadStrip(edgeTop(cellsY), edgeBottom(cellsY), cellsX + 1, false);

    // Left (i=0): outside = -x. Right (i=cellsX): outside = +x.
    function addQuadStripI(topEdge, bottomEdge, n, outsideIsNegX) {
      for (let k = 0; k < n - 1; k++) {
        const a = topEdge[k];
        const b = topEdge[k + 1];
        const c = bottomEdge[k + 1];
        const d = bottomEdge[k];
        if (outsideIsNegX) {
          addTri(a, b, c);
          addTri(a, c, d);
        } else {
          addTri(b, a, d);
          addTri(b, d, c);
        }
      }
    }
    addQuadStripI(edgeTopI(0), edgeBottomI(0), cellsY + 1, true);
    addQuadStripI(edgeTopI(cellsX), edgeBottomI(cellsX), cellsY + 1, false);

    return {
      verts,
      tris,
      wMM,
      hMM,
      depthMM: reliefMM,
      plateMM,
      cellsX,
      cellsY,
    };
  }

  // ----------------------------------------------------------------------------
  //  Binary STL writer
  // ----------------------------------------------------------------------------

  function facetNormal(verts, a, b, c) {
    const A = verts[a],
      B = verts[b],
      C = verts[c];
    const ux = B.x - A.x,
      uy = B.y - A.y,
      uz = B.z - A.z;
    const vx = C.x - A.x,
      vy = C.y - A.y,
      vz = C.z - A.z;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    return [nx / len, ny / len, nz / len];
  }

  function writeBinaryStl(verts, tris) {
    const vertexData = new ArrayBuffer(50 * tris.length + 84);
    const dv = new DataView(vertexData);
    const u8 = new Uint8Array(vertexData);
    u8.fill(0, 0, 80);
    new DataView(vertexData, 80, 4).setUint32(0, tris.length, true);
    let offset = 84;
    for (let t = 0; t < tris.length; t++) {
      const tri = tris[t];
      const [nx, ny, nz] = facetNormal(verts, tri.a, tri.b, tri.c);
      dv.setFloat32(offset, nx, true);
      dv.setFloat32(offset + 4, ny, true);
      dv.setFloat32(offset + 8, nz, true);
      offset += 12;
      const a = verts[tri.a],
        b = verts[tri.b],
        c = verts[tri.c];
      dv.setFloat32(offset, a.x, true);
      dv.setFloat32(offset + 4, a.y, true);
      dv.setFloat32(offset + 8, a.z, true);
      offset += 12;
      dv.setFloat32(offset, b.x, true);
      dv.setFloat32(offset + 4, b.y, true);
      dv.setFloat32(offset + 8, b.z, true);
      offset += 12;
      dv.setFloat32(offset, c.x, true);
      dv.setFloat32(offset + 4, c.y, true);
      dv.setFloat32(offset + 8, c.z, true);
      offset += 12;
      dv.setUint16(offset, 0, true);
      offset += 2;
    }
    return new Blob([vertexData], { type: "model/stl" });
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }

  // ----------------------------------------------------------------------------
  //  Heightfield geometry (pure; returns data a Three.js mesh can consume)
  // ----------------------------------------------------------------------------

  function buildHeightfieldGeometry(lum, cellsX, cellsY, opts) {
    opts = opts || {};
    const mmPerUnitMin = opts.mmPerUnitMin || 200;
    const reliefDepthRatio = opts.reliefDepthRatio || 0.12;
    const basePlateRatio = opts.basePlateRatio || 0.02;
    const smallPx = Math.min(cellsX, cellsY);
    const scaleMM = mmPerUnitMin / smallPx;
    const wMM = cellsX * scaleMM;
    const hMM = cellsY * scaleMM;
    const reliefMM = smallPx * reliefDepthRatio * scaleMM;
    const plateMM = Math.max(reliefMM * 0.25, smallPx * basePlateRatio * scaleMM);

    const heightMM = new Float32Array(cellsX * cellsY);
    for (let i = 0; i < cellsX * cellsY; i++) {
      heightMM[i] = plateMM + lum[i] * reliefMM;
    }

    const verts = [];
    const addV = (x, y, z) => verts.push({ x, y, z });
    function cellHeight(i, j) {
      const ci = Math.min(i, cellsX - 1);
      const cj = Math.min(j, cellsY - 1);
      return heightMM[cj * cellsX + ci];
    }
    for (let j = 0; j <= cellsY; j++) {
      for (let i = 0; i <= cellsX; i++) {
        const x = (i / cellsX) * wMM;
        const y = (j / cellsY) * hMM;
        const z = cellHeight(i, j);
        addV(x, y, z);
      }
    }

    const tris = [];
    function addTri(a, b, c) { tris.push({ a, b, c }); }
    const idx = (i, j) => j * (cellsX + 1) + i;

    for (let j = 0; j < cellsY; j++) {
      for (let i = 0; i < cellsX; i++) {
        const a = idx(i, j),
          b = idx(i + 1, j),
          c = idx(i, j + 1),
          d = idx(i + 1, j + 1);
        addTri(a, b, c);
        addTri(c, b, d);
      }
    }

    const bottomBase = verts.length;
    for (let j = 0; j <= cellsY; j++) {
      for (let i = 0; i <= cellsX; i++) {
        const x = (i / cellsX) * wMM;
        const y = (j / cellsY) * hMM;
        addV(x, y, 0);
      }
    }
    for (let j = 0; j < cellsY; j++) {
      for (let i = 0; i < cellsX; i++) {
        const a = bottomBase + idx(i, j),
          b = bottomBase + idx(i + 1, j),
          c = bottomBase + idx(i, j + 1),
          d = bottomBase + idx(i + 1, j + 1);
        addTri(a, c, b);
        addTri(c, d, b);
      }
    }

    function edgeTop(j) {
      const out = [];
      for (let i = 0; i <= cellsX; i++) out.push(idx(i, j));
      return out;
    }
    function edgeTopI(i) {
      const out = [];
      for (let j = 0; j <= cellsY; j++) out.push(idx(i, j));
      return out;
    }
    function edgeBottom(j) {
      const out = [];
      for (let i = 0; i <= cellsX; i++) out.push(bottomBase + idx(i, j));
      return out;
    }
    function edgeBottomI(i) {
      const out = [];
      for (let j = 0; j <= cellsY; j++) out.push(bottomBase + idx(i, j));
      return out;
    }
    function addQuadStrip(topEdge, bottomEdge, n, outsideIsNegY) {
      for (let k = 0; k < n - 1; k++) {
        const a = topEdge[k],
          b = topEdge[k + 1],
          c = bottomEdge[k + 1],
          d = bottomEdge[k];
        if (outsideIsNegY) {
          addTri(a, b, c);
          addTri(a, c, d);
        } else {
          addTri(b, a, d);
          addTri(b, d, c);
        }
      }
    }
    addQuadStrip(edgeTop(0), edgeBottom(0), cellsX + 1, true);
    addQuadStrip(edgeTop(cellsY), edgeBottom(cellsY), cellsX + 1, false);
    function addQuadStripI(topEdge, bottomEdge, n, outsideIsNegX) {
      for (let k = 0; k < n - 1; k++) {
        const a = topEdge[k],
          b = topEdge[k + 1],
          c = bottomEdge[k + 1],
          d = bottomEdge[k];
        if (outsideIsNegX) {
          addTri(a, b, c);
          addTri(a, c, d);
        } else {
          addTri(b, a, d);
          addTri(b, d, c);
        }
      }
    }
    addQuadStripI(edgeTopI(0), edgeBottomI(0), cellsY + 1, true);
    addQuadStripI(edgeTopI(cellsX), edgeBottomI(cellsX), cellsY + 1, false);

    return { verts, tris, wMM, hMM, depthMM: reliefMM, plateMM, cellsX, cellsY };
  }

  function buildHeightfieldFromImage(img, cells) {
    cells = cells || 192;
    const big = Math.max(img.naturalWidth, img.naturalHeight);
    const small = Math.min(img.naturalWidth, img.naturalHeight);
    const cellsX = Math.max(2, Math.round((img.naturalWidth / big) * cells));
    const cellsY = Math.max(2, Math.round((img.naturalHeight / big) * cells));
    const lum = luminanceGrid(img, cellsX, cellsY);
    return { lum, cellsX, cellsY, srcW: img.naturalWidth, srcH: img.naturalHeight };
  }

  // ----------------------------------------------------------------------------
  //  Public API
  // ----------------------------------------------------------------------------

  function buildStlFromImage(dataUrl, opts) {
    if (!dataUrl) throw new Error("No image data for STL");
    opts = opts || {};
    const cells = opts.cells || 192;
    const mmPerUnitMin = opts.mmPerUnitMin || 200;
    return loadImageFully(dataUrl).then((img) => {
      if (!img || !img.naturalWidth) throw new Error("Decoded image has no size");
      const big = Math.max(img.naturalWidth, img.naturalHeight);
      const small = Math.min(img.naturalWidth, img.naturalHeight);
      const cellsX = Math.max(2, Math.round((img.naturalWidth / big) * cells));
      const cellsY = Math.max(2, Math.round((img.naturalHeight / big) * cells));
      const lum = luminanceGrid(img, cellsX, cellsY);
      const mesh = buildHeightfieldMesh(lum, cellsX, cellsY, opts);
      const blob = writeBinaryStl(mesh.verts, mesh.tris);
      return {
        stlBlob: blob,
        stlBytes: blob.size,
        cellsX: mesh.cellsX,
        cellsY: mesh.cellsY,
        wMM: mesh.wMM,
        hMM: mesh.hMM,
        depthMM: mesh.depthMM,
        plateMM: mesh.plateMM,
        tris: mesh.tris.length,
        mmPerUnit: mmPerUnitMin / small,
        srcW: img.naturalWidth,
        srcH: img.naturalHeight,
      };
    });
  }

  function buildStlAsync(dataUrl, opts) {
    return buildStlFromImage(dataUrl, opts).then((r) => {
      r.stlDataUrl = URL.createObjectURL(r.stlBlob);
      return r;
    });
  }

  function attachStlToArtifact(artifact, result) {
    if (!artifact) artifact = {};
    artifact.stl = {
      kind: "heightfield-stl",
      source: "front-photo",
      note:
        "Heightfield/emboss STL from the front photo (relief, not a true multi-view reconstruction)",
      cellsX: result.cellsX,
      cellsY: result.cellsY,
      wMM: result.wMM,
      hMM: result.hMM,
      depthMM: result.depthMM,
      plateMM: result.plateMM,
      tris: result.tris,
      mmPerUnit: result.mmPerUnit,
      srcW: result.srcW,
      srcH: result.srcH,
      bytes: result.stlBytes,
      dataUrl: result.stlDataUrl,
    };
    return artifact;
  }

  function downloadStl(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 8000);
  }

  function downloadStlFromDataUrl(dataUrl, filename) {
    if (!dataUrl || !dataUrl.startsWith("data:")) return;
    fetch(dataUrl)
      .then((r) => r.blob())
      .then((b) => downloadStl(b, filename))
      .catch(() => {
        try {
          const bin = atob(dataUrl.split(",")[1]);
          const u8 = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
          downloadStl(new Blob([u8], { type: "model/stl" }), filename);
        } catch (e) {
          // silent
        }
      });
  }

  // Also expose a small STL preview as a PNG thumbnail of the heightfield
  // (so the review stage can show a real 3D-looking preview of the STL).
  function stlPreviewPng(result) {
    // Render the heightfield as a shaded relief PNG: sample the top surface
    // and fake-light from the top-left.
    const { verts, tris, wMM, hMM, cellsX, cellsY, depthMM, plateMM } = result;
    if (!verts || !tris || !cellsX || !cellsY) return null;
    const pxW = Math.max(64, Math.min(512, Math.round(cellsX)));
    const pxH = Math.max(64, Math.min(512, Math.round(cellsY)));
    const { c, ctx } = toCanvas(null, pxW, pxH);
    const imgData = ctx.createImageData(pxW, pxH);
    const out = imgData.data;

    // Map pixel (px,py) -> grid (i,j) -> vertex height -> shade.
    const lightDir = { x: 0.4, y: -0.3, z: 0.85 };
    const llen = Math.sqrt(lightDir.x ** 2 + lightDir.y ** 2 + lightDir.z ** 2) || 1;
    const lnx = lightDir.x / llen,
      lny = lightDir.y / llen,
      lnz = lightDir.z / llen;

    function topHeightAt(px, py) {
      const i = (px / pxW) * cellsX;
      const j = (py / pxH) * cellsY;
      const i0 = Math.floor(i),
        j0 = Math.floor(j);
      const i1 = Math.min(i0 + 1, cellsX),
        j1 = Math.min(j0 + 1, cellsY);
      const fx = i - i0,
        fy = j - j0;
      const z00 = (j0 < cellsY && i0 < cellsX) ? verts[idx(i0, j0)].z : plateMM;
      const z10 = (j0 < cellsY && i1 < cellsX) ? verts[idx(i1, j0)].z : plateMM;
      const z01 = (j1 < cellsY && i0 < cellsX) ? verts[idx(i0, j1)].z : plateMM;
      const z11 = (j1 < cellsY && i1 < cellsX) ? verts[idx(i1, j1)].z : plateMM;
      const z0 = z00 + (z10 - z00) * fx;
      const z1 = z00 + (z01 - z00) * fy;
      return z0 + (z1 - z0) * ((j - j0) - (j - j0 | 0));
    }

    for (let py = 0; py < pxH; py++) {
      for (let px = 0; px < pxW; px++) {
        const x = (px / pxW) * wMM - wMM / 2;
        const y = (py / pxH) * hMM - hMM / 2;
        const z = topHeightAt(px, py);
        const pidx = (py * pxW + px) * 4;
        // Fake diffuse from top-left light, plus a base tint.
        const ndx = 0;
        const ndy = 0;
        const ndz = 1;
        const diff = Math.max(0, ndx * lnx + ndy * lny + ndz * lnz);
        const base = 90 + 90 * (z / (depthMM || 1));
        const r = Math.min(255, Math.max(0, base + diff * 80));
        const g = Math.min(255, Math.max(0, base + diff * 80));
        const b = Math.min(255, Math.max(0, base + diff * 90));
        out[pidx] = r;
        out[pidx + 1] = g;
        out[pidx + 2] = b;
        out[pidx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    return c.toDataURL("image/png");
  }

  // ----------------------------------------------------------------------------
  //  Local helpers (also defined in clothing-library.js; duplicated here so this
  //  module is self-contained and the hook can be consumed by any caller).
  // ----------------------------------------------------------------------------

  function slugifyLocal(s) {
    return String(s == null ? "" : s)
      .toLowerCase()
      .replace(/[^\w\s-]+/g, "")
      .replace(/[-\s]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "garment";
  }

  function fmtBytesLocal(b) {
    if (b == null) return "—";
    if (b < 1024) return b + " B";
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + " KB";
    return (b / (1024 * 1024)).toFixed(2) + " MB";
  }

  // ----------------------------------------------------------------------------
  //  Expose via hook + keep DOM-free (DOM wiring lives in clothing-library.js)
  // ----------------------------------------------------------------------------

  window.__tcImageToStl = {
    buildStlFromImage,
    buildStlAsync,
    attachStlToArtifact,
    downloadStl,
    downloadStlFromDataUrl,
    buildHeightfieldGeometry,
    buildHeightfieldFromImage,
    stlPreviewPng,
    slugifyLocal,
    fmtBytesLocal,
  };
})();
