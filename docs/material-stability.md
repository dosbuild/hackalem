# Stable materials, shadows and depth

The renderer binds surface marks and pencil shadow texture to object/world
coordinates. Camera input changes projection while material placement, building
height, color and lighting remain stable. Ground paint shares a common plane-depth
calculation so overlapping map polygons keep deterministic layer ordering.
Physical buildings, people and projects retain their normal depth occlusion.

Shadows use three fixed world-space projections, each with separate static and
dynamic depth attachments. Their extents and bias do not change with zoom. Local
grids snap to whole texel blocks; continuous focus weights blend their coverage.
Moving objects update cached dynamic depth without redrawing all static buildings.
Removing an object invalidates its former shadow.

Six standard **1024²** depth targets allocate **24 MiB**; the lower-memory **512²**
setting allocates **6 MiB**. These are allocated depth-target bytes, excluding
browser, driver, default framebuffer and MSAA overhead. Ink targets and native
geometry have separate resource accounting. Earlier 2048²/96 MiB measurements
belong to a retired configuration.

Rebuild and restart the production server before checking the current renderer:

```sh
npm run verify
npm start
npm run test:materials
npm run test:renderer
npm run test:zoom
```

Run GPU gates sequentially. Material checks compare actual raster pixels across
minute zoom changes and reverse camera travel, including flat-surface interior
flips. Depth checks exercise overlapping ground paint, foreground occlusion and
people through the production shaders. Lifecycle checks verify stable allocations
across navigation/world changes and disposal of textures, buffers and programs.
Input checks measure CPU submission, GPU queries when supported, and frame cadence
as separate quantities. A browser frame interval is not a GPU execution time.

Current results and tested build identity belong to [release verification](release.md).
Reports, screenshots and recordings remain in ignored `artifacts/`. No historical
measurement is presented as a fresh result for this visual pass.
