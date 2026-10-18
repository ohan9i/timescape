# Forest Window asset provenance

Retrieved 2026-10-18 directly from the official Poly Haven API and `dl.polyhaven.org`. All listed assets are dedicated to CC0 1.0. Redistribution and adaptation are permitted, including commercial use. The forest, interior and weather remain real-time 3D; a photographic HDRI sky is available for the sky dome and matching image-based lighting.

- Official license: https://polyhaven.com/license
- CC0 legal text: https://creativecommons.org/publicdomain/zero/1.0/
- Poly Haven API: https://api.polyhaven.com/

## Downloaded assets

| Asset | Source and authors | Local files | Intended use |
| --- | --- | --- | --- |
| Fern 02 | https://polyhaven.com/a/fern_02 — Rob Tuytel (scanning), Rico Cilliers (modeling) | `forest/fern_02/fern_02_1k.gltf`, BIN, 1K diffuse/normal/ARM and separate alpha | Four actual 3D fern clump variants, 6,232 triangles across the source collection. |
| Shrub 01 — researched, not deployed | https://polyhaven.com/a/shrub_01 — Rico Cilliers | Original glTF, BIN and 1K textures retained only in `WOW/asset-work/shrub_01` | Not used by the scene; excluded from public runtime assets. The downloaded glTF has 156,012 triangles. |
| Searsia Lucida | https://polyhaven.com/a/searsia_lucida — James Ray Cock (modeling), Jenelle van Heerden (photography) | `forest/searsia_lucida/searsia_lucida_1k.gltf`, packed BIN, 1K diffuse/normal/ARM and separate alpha | Broadleaf shrub branches/leaves and trunk. Only the four used original meshes are packed; seven node slots remain for stable scene selection. |
| Wood Table | https://polyhaven.com/a/wood_table — Dimitrios Savva | `forest/wood-color.jpg`, `forest/wood-normal.jpg`, `forest/wood-roughness.jpg` | Real scanned surface on the modeled foreground desk and timber. |
| Forest Ground 04 | https://polyhaven.com/a/forest_ground_04 — Rob Tuytel (photography/processing), Rico Cilliers (minor adjustment) | `forest/ground-color.jpg`, `forest/ground-normal.jpg` | Actual 3D forest floor material; 1K, approximately 3.15 m scan area. |
| Island Tree 02 | https://polyhaven.com/a/island_tree_02 — Rob Tuytel (scanning/processing), Rico Cilliers (cleanup/processing) | `forest/island_tree_02/` 1K trunk, leaf and branch textures plus leaf alpha; optimized glTF+BIN | Actual broadleaf tree structure and canopy. Original 40,686,576-byte BIN is kept outside the runtime project in `WOW/asset-work/island_tree_02`; the shipped 10,873,640-byte derivative contains NEAR and FAR alternatives. |

Exact original URLs, file sizes and MD5 hashes are recorded in `forest/source-manifest.json`. Each downloaded file was checked against the official API size and MD5 before use.

The manifest is a research/download provenance record, including the unused Shrub 01 and original unoptimized files. It is not a list of deployed assets or expected hashes of derived runtime meshes.

## Integration notes

### Sky and close-range 2K detail upgrade — 2026-10-18

All original files remain unchanged. The eight new files in `forest/high/` total 18,667,082 bytes (17.80 MiB), excluding their manifest. `forest/high/source-manifest.json` records the exact official URL, validated API byte size and MD5, local SHA-256, retrieval date and license for every addition.

| Asset | Author and source | New local files | Use |
| --- | --- | --- | --- |
| Kloofendal Overcast (Pure Sky) | Greg Zaal — https://polyhaven.com/a/kloofendal_overcast_puresky | `high/sky-overcast-2k.hdr` (4,335,717 bytes), `high/sky-overcast-1k.hdr` (1,174,053 bytes) | Photographic equirectangular RGBE sky; 2K for desktop, 1K for lower bandwidth. Use the same HDR source for the displayed sky and PMREM environment, with consistent time/weather grading. |
| Wood Table | Dimitrios Savva — https://polyhaven.com/a/wood_table | `high/wood-color-2k.jpg` (3,954,552 bytes) | Higher-resolution scanned color for close desk/window wood. Existing 1K normal/roughness remain available. |
| Island Tree 02 | Rob Tuytel; Rico Cilliers — https://polyhaven.com/a/island_tree_02 | `high/tree-bark-color-2k.jpg` (2,684,467 bytes), `high/tree-bark-normal-2k.jpg` (4,339,456 bytes), `high/tree-leaves-color-2k.jpg` (661,175 bytes), `high/tree-leaves-normal-2k.jpg` (1,378,585 bytes), `high/tree-leaves-alpha-2k.png` (139,077 bytes) | Close-range trunk and leaf detail; retain source UV orientation, `flipY = false` on glTF texture replacement, sRGB only for color, and matching leaf alpha for visible/depth passes. |

Both HDR files successfully decoded with Three.js RGBELoader: 1024×512 and 2048×1024, four half-float channels. RGBELoader is deprecated in the installed Three.js build; HDRLoader is its current replacement. The overcast source has diffuse cloud illumination, which avoids introducing a second prominent hard sun beside the scene's dynamic sun. Cloud form is photographic, but time of day, seasonal change, weather and lighting adjustments remain artistic real-time approximations; this single capture is not an astronomical sky simulation.

The additional assets are all CC0, under the same official license linked above. No full-resolution model BIN or unrelated HDRI was added.

The official glTF diffuse files are JPEG and do not embed alpha. Load the separately supplied alpha image with `flipY = false`, set `alphaTest`, and keep depth writing enabled for clean vegetation. Alpha-tested shadows must use the same texture and vertex deformation. Correct materials should use the color texture as sRGB and normal/alpha/ARM maps as linear data.

Searsia source node triangle counts (all named LOD0 in the original export): a 113,405; b 88,629; c 77,603; d 56,320; e 27,701; f 7,232; g 6,302. These are plant variants with different dimensions, not equivalent LODs of one tree: retained c/e/f/g are approximately 1.68/1.03/0.74/0.79 m tall. The scene accounts for their sizes explicitly. The meshes contain separate `searsia_lucida`, `searsia_lucida_leaves`, and `searsia_lucida_twigs` materials, allowing leaves to change season independently from woody geometry.

The Searsia runtime BIN was losslessly packed from 17,913,396 to 5,400,110 bytes by retaining the original meshes at source nodes 2, 4, 5 and 6. Positions, normals, UVs, indices and accessor bounds were copied verbatim, with no new geometric decimation. Seven scene node slots are preserved: unused 0/1 alias mesh 2, unused 3 aliases mesh 4. The original glTF/BIN and reproducible `pack-searsia.mjs` script are retained in `WOW/asset-work`; twelve primitive index ranges were verified after packing.

Searsia is an arid-region plant, so its scan is used as an artistic broadleaf structural reference; the scene does not claim to reconstruct a botanically accurate location. Fern and shrub meshes use leaf/frond cards within actual spatial plant geometry, not whole-tree billboard replacement.

Island Tree 02 raw glTF has 1,072,213 triangles: trunk 27,298, foliage 714,744, branch clusters 330,171. This is intended for an optimized derivative; the full original is not an appropriate repeated browser forest mesh. Its original dimensions are approximately 8.49 m wide, 4.08 m deep and 3.41 m tall. The artistic scene may rescale it and does not claim a geographically exact coastal biome.

The optimized derivative was generated with meshoptimizer (MIT) using `simplifyWithUpdate`, attribute-aware normal and UV weights, and topology pruning. NEAR has 163,574 triangles (the original 27,298-triangle trunk preserved); FAR has 33,840. Select either `island_tree_02_NEAR` (node 0) or `island_tree_02_FAR` (node 1) rather than render both alternative nodes simultaneously. Exact per-primitive counts and relative simplification errors are in `forest/island_tree_02/optimization.json`. `forest/source-manifest.json` records hashes of the original downloads, not hashes of the optimized glTF/BIN. The optimizer script is retained in `WOW/asset-work/optimize-island.mjs` alongside the original source files. Buffer sizes, image references, finite attributes and index bounds were validated after conversion.

### Organic forest floor PBR upgrade — 2026-10-18

**Forest Leaves 02**, Rob Tuytel — https://polyhaven.com/a/forest_leaves_02 . Official CC0 scanned leaf litter, twigs, soil fissures and moss. New files in `forest/high/` total **5,390,915 bytes**: `ground-color-2k.jpg` (1,668,009), `ground-normal-2k.jpg` (2,323,898), `ground-arm-2k.jpg` (1,066,850), `ground-displacement-2k.jpg` (332,158). All four are 2048×2048 JPEGs. File sizes and MD5 hashes were verified against https://api.polyhaven.com/files/forest_leaves_02 ; exact URLs, validated MD5 and local SHA-256 are recorded in `forest/high/ground-source-manifest.json`.

The diffuse map is sRGB; normal, ARM and displacement maps contain linear data. The normal is **OpenGL (+Y)**. Packed ARM channels are **R = ambient occlusion, G = roughness, B = metallic**; this is organic dielectric terrain, so metallic response should remain zero. The height map supports shallow physical surface relief; it is not a landscape elevation model. Existing Forest Ground 04 files remain preserved. The organic floor should be shaded through scanned normal, roughness and AO rather than through a single saturated green multiplier.
