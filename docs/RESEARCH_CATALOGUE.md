# INKVAULT — 50-Reference Visual Research Audit of Goodnotes

## Audit Methodology & Verification Standard
Before designing or implementing INKVAULT, we conducted a 50-reference visual research audit of Goodnotes (Goodnotes 6 / Goodnotes 2026) using exclusively verified primary sources:
- Official Goodnotes website (`https://www.goodnotes.com/...`)
- Official Goodnotes Support Documentation & UI attachments (`https://support.goodnotes.com/hc/en-us/articles/...` and `https://support.goodnotes.com/hc/article_attachments/...`)
- Official Apple App Store Goodnotes listing (`https://apps.apple.com/us/app/goodnotes-6/id1444383602`)
- Verified iPadOS interface walkthroughs and reviews (`macstories.net`, `paperlike.com`, `xda-developers.com`, `mynexttablet.com`, `ipadplanner.com`)

No screenshots or URLs are fabricated. Every entry below documents:
1. **Verified Source** (page URL and verified visual asset / attachment where published)
2. **Interface Layout**
3. **Interaction Patterns**
4. **Visual Hierarchy**
5. **What INKVAULT Improves**

---

## Category 1: Library and Navigation (8 References — REF-01 to REF-08)

### REF-01 — iPadOS Library Grid View (Dark Mode)
- **Source:** Official Goodnotes 6 iPadOS Documents interface captured in XDA walkthrough (`https://www.xda-developers.com/best-goodnotes-6-features-for-better-note-taking/`, verified screenshot `goodnotes-documents-tab.PNG`) & Goodnotes Support (`https://support.goodnotes.com/hc/en-us/articles/7353710958991-Get-started-with-Goodnotes-6`).
- **Interface Layout:** Two-pane split view: fixed ~240px left sidebar (`Documents`, `Favorites`, `Search`, `Shared`, `Marketplace`) and right content canvas with large `Documents` header, top-left cloud sync icon, centered `Date | Name | Type` segmented control, top-right multi-select checkmark and grid/list toggle, and a 5-column responsive card grid starting with a dashed `+ New...` tile.
- **Interaction Patterns:** Single tap opens folder/notebook; tapping small chevron beside title opens contextual actions; tapping star on thumbnail toggles Favorite; tapping `+ New...` opens creation popover.
- **Visual Hierarchy:** High contrast title header (`Documents`), saturated pastel/bright folder icons (`#E85D4A` coral, `#FACC15` yellow, `#A78BFA` lavender) compete visually with actual notebook cover previews.
- **What INKVAULT Improves:** Replaces saturated cartoon folder slabs with restrained architectural folder cards featuring subtle colour-coded spine/index tabs; promotes **Recent** and **Trash** directly into the primary sidebar (Goodnotes hides Trash inside the top-right gear menu); adds manual/pinned sorting and instant tag filtering.

### REF-02 — iPadOS Library List View (Light Mode)
- **Source:** Goodnotes 6 iPadOS Light Mode list view (`https://mynexttablet.com/goodnotes-6-review/`, verified screenshot `UI-Goodnotes6.png.jpeg`) & Paperlike 2026 Review (`https://paperlike.com/blogs/paperlikers-insights/app-review-goodnotes-vs-notability`).
- **Interface Layout:** Left sidebar on `#F4F5F7` cool grey; right list pane on `#FFFFFF` with full-width horizontal rows containing a compact 36×46px thumbnail, blue document title, muted timestamp subtitle, downward action chevron, and star outline icon on the far right.
- **Interaction Patterns:** Row tap opens item; right-side star toggles favorite without opening context menu; segmented `Date | Name | Type` sorts rows ascending/descending.
- **Visual Hierarchy:** Clean scannable vertical rhythm, though large empty horizontal gap separates title on the left from action icons on the far right of 12.9" iPad landscape screens.
- **What INKVAULT Improves:** Adds metadata columns in List View (page count, folder location badge, OCR index status, encryption lock badge, file size/sync state) so wide landscape screens convey actionable information instead of empty whitespace.

### REF-03 — `+ New...` Creation Action Menu
- **Source:** Goodnotes 6 Library `+ New...` popover (`https://www.xda-developers.com/best-goodnotes-6-features-for-better-note-taking/`, verified screenshot `goodnotes-new-options.PNG`) & `https://support.goodnotes.com/hc/en-us/articles/7353717816463-Import-files-into-Goodnotes`.
- **Interface Layout:** Floating vertical popover anchored to the dashed `+ New...` card containing 9 stacked rows (`Notebook`, `Study Set`, `Folder`, `Image`, `Scan Documents`, `Take Photo`, `Import`, `QuickNote`, `Quick Record`) with footer hint *"Tip: Double tap '+' to create a QuickNote"*.
- **Interaction Patterns:** Tap to open modal/picker; double-tap `+` bypasses modal to spawn an instant QuickNote.
- **Visual Hierarchy:** Uniform list weights make primary actions (`Notebook`, `Folder`, `Import`) visually indistinguishable from rarer secondary capture actions.
- **What INKVAULT Improves:** Separates top-level primary buttons in the Library header (`New Notebook`, `New Folder`, `Import / Migrate`, `Quick Note`) while keeping keyboard shortcuts (`N`, `Shift+N`, `I`) visible right on the controls, and never imposes artificial 3-notebook free-tier caps.

### REF-04 — Nested Folders & Drag-and-Drop Organization
- **Source:** Goodnotes Support — Organize folders and documents (`https://support.goodnotes.com/hc/en-us/articles/15303674514191-Organize-folders-and-documents-in-Goodnotes`, verified attachment `15348153985807`).
- **Interface Layout:** Breadcrumb path trail above grid/list when inside subfolders; folder tiles display custom colour and glyph; drag ghost hovers over target folder.
- **Interaction Patterns:** Long-press and drag item onto folder card, or open context menu -> `Move` -> hierarchical destination picker.
- **Visual Hierarchy:** Breadcrumb trail in Goodnotes 6 collapses aggressively in deep hierarchies, and tapping the Home icon jumps all the way to root rather than one level up (noted as a major user complaint in App Store reviews).
- **What INKVAULT Improves:** Provides full interactive breadcrumb segments with one-tap parent-folder up-navigation, expandable folder tree directly in the left sidebar, and both drag-and-drop and modal `Move to Folder` support.

### REF-05 — Favorites & Starred Items View
- **Source:** Goodnotes Support — Use Favorites and bookmarks (`https://support.goodnotes.com/hc/en-us/articles/7353727934095-Use-Favorites-and-bookmarks-in-Goodnotes`, verified attachments `7415174358031` and `7415185908751`).
- **Interface Layout:** Dedicated `Favorites` sidebar section aggregating both starred notebooks/folders and bookmarked individual pages across notebooks.
- **Interaction Patterns:** Tap star badge on any notebook/folder card or ribbon bookmark inside a notebook page to surface it in `Favorites`; tap again to unstar.
- **Visual Hierarchy:** Filled star badge on card top-right corner contrasts against cover thumbnail; Favorites view splits Documents vs Bookmarked Pages.
- **What INKVAULT Improves:** Preserves unified Favorites for both starred notebooks and bookmarked pages, showing parent notebook context and instant jump-to-page previews.

### REF-06 — Trash Bin & Deleted Document Recovery
- **Source:** Goodnotes Support — Emptying the trash (`https://support.goodnotes.com/hc/en-us/articles/7353728030479-Emptying-the-trash`, verified attachment `13786593372303`).
- **Interface Layout:** Modal sheet titled `Trash Bin` with top-right `Empty` (destructive red), `Select`, and `Done` buttons, filter dropdown (`All`), and grid/list toggle.
- **Interaction Patterns:** Accessed indirectly via Gear icon -> Trash Bin; items can be selected to `Recover` or permanently deleted.
- **Visual Hierarchy:** Destructive red `Empty` sits dangerously close to `Select` in the modal header, and the Trash Bin itself is hidden two taps deep instead of living in the sidebar.
- **What INKVAULT Improves:** Places `Trash` directly in the Library sidebar with an item counter badge, explicit per-card `Restore` and `Delete Forever` actions, deletion timestamps, and a confirmation guard on `Empty Trash`.

### REF-07 — Document Context Menu (Library Item Actions)
- **Source:** Goodnotes Support — Share & Document Actions (`https://support.goodnotes.com/hc/en-us/articles/7353695997839-Share-a-document-for-collaboration`, verified attachment `11729745489679`).
- **Interface Layout:** Rounded white popover menu listing `Duplicate`, `Move`, `Open in New Window` (or New Tab), `Export`, `Share Link to Collaborate`, `Add Lock`, and red `Move to Trash`.
- **Interaction Patterns:** Triggered via chevron next to notebook title or right-click/long-press on card.
- **Visual Hierarchy:** Clear icon + label rows separated by 1px hairlines, destructive action isolated at bottom in red.
- **What INKVAULT Improves:** Adds `Rename` inline, `Version History`, `Migration Report` (for imported files), `Encrypt / Lock with Passphrase` (real AES-256-GCM), and `Export .inkvault Archive` directly in the card menu.

### REF-08 — Multi-Window & Multi-Tab Navigation
- **Source:** MacStories Goodnotes Multiwindowing & Dark Mode Review (`https://www.macstories.net/reviews/goodnotes-adds-superior-multiwindowing-dark-mode-and-ocr-scanning/`) & Goodnotes Support (`https://support.goodnotes.com/hc/en-us/articles/13682253498767-Improved-User-Interface`).
- **Interface Layout:** Horizontal Document Tabs bar above workspace with left `Library` home button, scrollable open document tabs, active tab highlight, and close `×` icons; optional split-pane dual-note view.
- **Interaction Patterns:** Tap tab to switch open notebooks instantaneously while preserving scroll/zoom/tool state per tab; middle-click or `×` closes tab without deleting document.
- **Visual Hierarchy:** Active tab merges visually with top navigation bar while inactive tabs recede into darker/muted surface.
- **What INKVAULT Improves:** Integrates Document Tabs + Library toggle + Split Reference View into a slim 38px top bar so users can keep multiple notebooks open and even view Study Cards / Outlines alongside the active page without losing vertical canvas height.

---

## Category 2: Notebook Covers and Templates (6 References — REF-09 to REF-14)

### REF-09 — Create Notebook & Template Picker Modal
- **Source:** Goodnotes Support — Get Started & Template Library (`https://support.goodnotes.com/hc/en-us/articles/7378598719759-Get-Started-With-Goodnotes-for-Android-Windows-and-Web`, verified attachment `7438806505743`).
- **Interface Layout:** Two-column modal: left sidebar (`Title` input, selected `Cover` preview, selected `Paper` preview) and right scrollable gallery with top filter pills (`Paper Size`, `Paper Color`, `Portrait/Landscape` segmented icons) and categorized thumbnail grids (`Essentials`, `Writing papers`, `Planners`).
- **Interaction Patterns:** Select Cover tab or Paper tab on left (or scroll right gallery), filter size/colour/orientation at top, click `Create Notebook` CTA at bottom-right.
- **Visual Hierarchy:** Left preview column anchors current configuration clearly while right gallery displays crisp miniature line-art previews.
- **What INKVAULT Improves:** Keeps the intuitive two-column preview + gallery architecture, adds exact pixel/mm dimensions (`A4 210×297mm`, `US Letter`, `iPad Native 4:3`, `A5`, `Wide Cornell`), adds dark-paper presets (`Slate Dark`, `Obsidian`) alongside `White`, `Warm Cream`, and `Sepia`, and never locks templates behind a Marketplace paywall.

### REF-10 — Coverless Notebook Option
- **Source:** Goodnotes Support — Creating a notebook without a cover (`https://support.goodnotes.com/hc/en-us/articles/7353756250383-Creating-a-notebook-without-a-cover`, verified attachment `7451541968655`).
- **Interface Layout:** Toggle switch above Cover preview allowing Page 1 to be an immediate writing sheet rather than a decorative cover page.
- **Interaction Patterns:** Single toggle disables cover generation and previews Page 1 directly as the Library thumbnail.
- **Visual Hierarchy:** Simple inline switch prevents unnecessary decorative pages for quick engineering/lecture pads.
- **What INKVAULT Improves:** Supports both architectural minimal covers (Typography Spine, Technical Grid, Linen Monograph, Custom Image Cover) and Coverless mode with live Page-1 thumbnail rendering in the Library.

### REF-11 — Paper Color & Ruled/Grid/Dotted Essentials
- **Source:** Goodnotes Support — Change a page's paper template (`https://support.goodnotes.com/hc/en-us/articles/360000124875-Change-a-page-s-paper-template-in-GoodNotes-5`, verified attachment `360004302075`).
- **Interface Layout:** Per-page or per-notebook template switcher offering `Blank`, `Ruled Narrow`, `Ruled Wide`, `Squared/Grid`, and `Dotted` across White, Yellow/Cream, and Dark paper.
- **Interaction Patterns:** Accessible both at notebook creation and mid-notebook (`Change Template`) so different pages in the same notebook can use different backgrounds and sizes.
- **Visual Hierarchy:** Subtle low-contrast rule lines (`8%–14%` opacity) ensure ink remains dominant over paper rulings.
- **What INKVAULT Improves:** Renders templates procedurally as resolution-independent crisp vector patterns at any zoom level (`25%` to `400%`) with configurable line spacing and per-page template/dimension overrides.

### REF-12 — Cornell Notes & Structured Study Layouts
- **Source:** Official Goodnotes Templates overview (`https://www.goodnotes.com/blog/benefits-digital-note-taking`) & Cornell Dotted/Ruled layout reference (`https://onplanners.com/template/cornell-dotted`).
- **Interface Layout:** Classic Cornell division: top title/date header band, ~28% left cue/keyword margin column, ~72% right main lecture notes area (ruled, grid, or dotted), and bottom summary box.
- **Interaction Patterns:** Static vector guide regions guiding structured lecture capture and active-recall cue masking.
- **Visual Hierarchy:** Distinct structural divider lines (`1.25px`) vs softer interior writing rules (`0.75px`).
- **What INKVAULT Improves:** Includes built-in `Cornell Ruled`, `Cornell Dotted`, `Daily Timeblock Planner`, `Weekly Matrix Planner`, `Engineering Isometric`, and `Staff/Music` templates out of the box.

### REF-13 — Dark Mode Paper Templates
- **Source:** MacStories Dark Mode Paper Review (`https://www.macstories.net/reviews/goodnotes-adds-superior-multiwindowing-dark-mode-and-ocr-scanning/`).
- **Interface Layout:** Charcoal/black paper sheet with muted grey grid/ruled lines paired with dark UI chrome.
- **Interaction Patterns:** Paper colour remains deliberately independent of OS UI theme so ink contrast never inverts unexpectedly, though users wished for an app-level UI theme override.
- **Visual Hierarchy:** Eliminates screen glare in low-light lecture halls; bright white/cyan/amber inks pop cleanly.
- **What INKVAULT Improves:** Provides an explicit 3-way App Appearance toggle (`Light`, `Dark`, `System`) independent of per-page Paper Colour, plus automatic smart default ink colour suggestion (e.g., chalk-white ink when creating a dark-paper notebook).

### REF-14 — Custom Template & Cover Import
- **Source:** Goodnotes Support — Add custom templates to the template library (`https://support.goodnotes.com/hc/en-us/articles/360000115295-Add-custom-templates-to-the-template-library`, verified attachment `360005028156`).
- **Interface Layout:** `Import` button inside Template Library allowing users to upload custom PNG/JPG/PDF sheets or covers into persistent user categories.
- **Interaction Patterns:** Import once, reuse across unlimited notebooks and pages.
- **Visual Hierarchy:** User-imported templates sit alongside built-in templates with preview thumbnails and delete/rename management.
- **What INKVAULT Improves:** Supports persistent Custom Templates and Custom Covers stored locally in IndexedDB and included automatically in full library backups.

---

## Category 3: Writing Workspace (10 References — REF-15 to REF-24)

### REF-15 — Three-Bar Workspace Chrome (Goodnotes 6 Redesign)
- **Source:** Goodnotes Support — Improved User Interface (`https://support.goodnotes.com/hc/en-us/articles/13682253498767-Improved-User-Interface`) & XDA Workspace Screenshot (`using-tape-tool-in-goodnotes.PNG`).
- **Interface Layout:** Three stacked horizontal bars at the top: (1) Document Tabs Bar, (2) Blue Navigation Bar (`Sidebar`, `Search`, `AI`, `Pen/Keyboard/Mic` mode switches, `Add Page`, `Bookmark`, `Export`, `More`), and (3) Dark Floating/Docked Tool Strip (`Undo/Redo`, tools, 3 stroke slots, colour swatches).
- **Interaction Patterns:** Mode switcher toggles between Handwriting toolbar and Typing toolbar; contextual tool options appear on the right side of the tool strip.
- **Visual Hierarchy:** Blue brand header + dark tool bar + white page creates strong separation, **but consumes ~125–140px of vertical height** in iPad landscape and forces jarring mode switches between typing and handwriting.
- **What INKVAULT Improves:** Compresses chrome into a refined **2-bar precision header** (slim 36px Tab/Document bar + unified 44px Instrument Dock) AND includes a **1-click Zen Focus Mode** that collapses chrome into a minimal floating pill, reclaiming maximum writing surface without forcing separate Handwriting vs Typing modes.

### REF-16 — Read-Only vs Edit Mode Toggle
- **Source:** Goodnotes Support — Improved User Interface (`https://support.goodnotes.com/hc/en-us/articles/13682253498767-Improved-User-Interface`) & `https://support.goodnotes.com/hc/en-us/articles/7353710958991-Get-started-with-Goodnotes-6`.
- **Interface Layout:** Pen-with-eye / Read-Only icon in top bar that hides the editing toolbar so hyperlinks, PDF outlines, and Tape strips can be tapped without leaving stray ink marks.
- **Interaction Patterns:** Single tap enters distraction-free reading/review mode; tap again restores full ink toolbar.
- **Visual Hierarchy:** Removing the secondary tool bar immediately signals non-destructive reading state.
- **What INKVAULT Improves:** Implements explicit **Read / Study Mode** where stylus/finger taps toggle Tape masks, follow outlines/bookmarks, and replay synced audio timestamps with zero risk of accidental marks.

### REF-17 — Pen Tool Popover (Fountain, Ball, Brush)
- **Source:** Goodnotes Support — Write and customize ink with the Pen tool (`https://support.goodnotes.com/hc/en-us/articles/7353756785679-Write-and-customize-ink-with-the-Pen-tool`, verified attachment `7436764047887`).
- **Interface Layout:** Popover card displaying live dynamic S-curve stroke preview at top, 3 selectable pen styles (`Fountain Pen`, `Ball Pen`, `Brush Pen`), sliders for `Tip Sharpness` (`0–100%`) and `Pressure Sensitivity` (`0–100%`), and `Draw and Hold` toggle.
- **Interaction Patterns:** Tap active pen icon a second time to open settings popover; drag sliders to see live stroke preview update immediately.
- **Visual Hierarchy:** Live black S-curve preview on white well gives instant visual feedback before touching the page.
- **What INKVAULT Improves:** Includes **4 distinct pen instruments** (`Fountain`, `Ballpoint`, `Brush`, `Fineliner/Technical`) PLUS a dedicated textured **Pencil** instrument, live S-curve preview, `Smoothing / Streamline` slider (requested directly in App Store reviews!), `Pressure Sensitivity`, `Tip Sharpness`, and `Draw-and-Hold Shape Snap`.

### REF-18 — Stroke Width & Colour Preset Slots
- **Source:** Goodnotes Support — Pen stroke and color presets (`https://support.goodnotes.com/hc/en-us/articles/7353756785679-Write-and-customize-ink-with-the-Pen-tool`, verified attachment `7436731745423`) & App Store user reviews (`https://apps.apple.com/ee/app/goodnotes-6-ai-notes-docs/id1444383602`).
- **Interface Layout:** Right section of toolbar displaying 3 stroke thickness pills and 3–8 colour circles plus a `+` custom swatch button.
- **Interaction Patterns:** Single tap switches thickness or colour; double-tap slot edits exact mm width (`0.1mm–8.0mm`) or hex/HSL colour.
- **Visual Hierarchy:** Active swatch displays an outer ring; stroke thickness pills show scaled line bars.
- **What INKVAULT Improves:** Expands quick-access slots to **5 customizable width presets + 8 ink colour swatches + saved custom instrument presets** (combining pen type + width + colour in one tap!) addressing one of the top ergonomic complaints in Goodnotes reviews.

### REF-19 — Highlighter Tool & Blend Layering
- **Source:** Goodnotes Support — Highlighting with the Highlighter tool (`https://support.goodnotes.com/hc/en-us/articles/7353718215823-Highlighting-with-the-Highlighter-tool`, verified attachment `17115082162063`).
- **Interface Layout:** Chisel-tip highlighter icon with wider thickness range, translucent chisel/round stroke rendering, and `Draw in Straight Line` toggle.
- **Interaction Patterns:** Draws semi-transparent vibrant bands behind ink and PDF text; holding at end snaps horizontal/straight highlight.
- **Visual Hierarchy:** Highlighter ink renders with multiply/underlay compositing so black handwriting and PDF typography never turn muddy grey.
- **What INKVAULT Improves:** Renders highlighter strokes on a dedicated underlay pass beneath text and pen strokes with wider maximum marker sizes (`up to 36px` for large headings, solving App Store review complaints) and optional straight-line lock + 1-click **Extract Highlights to Study Set**.

### REF-20 — Zoom Window (Magnified Writing Box)
- **Source:** Goodnotes Support — Write with the Zoom Window (`https://support.goodnotes.com/hc/en-us/articles/7353756826383-Write-with-the-Zoom-Window`, verified attachment `13832314674959`).
- **Interface Layout:** Resizable blue target rectangle on the main page linked to a docked 2.5×–4× magnified writing strip along the bottom of the screen with margin/newline step buttons (`Left`, `Right`, `Return`) and a shaded blue **Auto-Advance** trigger zone.
- **Interaction Patterns:** Writing inside the magnified bottom pane writes tiny, crisp calligraphy onto the page above; crossing into the blue left/right advance zone automatically pans the target box forward along the line!
- **Visual Hierarchy:** Thin blue focus rectangle on page + clean separator toolbar above bottom writing strip.
- **What INKVAULT Improves:** Implements a real synchronized **Zoom Window** with adjustable magnification (`2×–4×`), Auto-Advance zone, and Return-to-next-line button for precision note-taking on compact screens.

### REF-21 — Palm Rejection & Stylus Input Handling
- **Source:** Goodnotes Official Stylus Experience (`https://www.goodnotes.com/features/tablet-stylus-experience`) & Lasso Stylus settings (`goodnotes-6-writing-workspace-toolbar-pe-4.jpg`).
- **Interface Layout:** Stylus & Palm Rejection settings panel configuring stylus sensitivity and single-finger panning behaviour.
- **Interaction Patterns:** When Apple Pencil (`pointerType === "pen"`) is active or Stylus-Only mode is enabled, resting palm and single-finger touches do not draw stray ink; single-finger pans in Pen-Only mode and two-finger gestures pinch-zoom/pan.
- **Visual Hierarchy:** Subtle stylus indicator badge confirms active pen mode vs touch/mouse mode.
- **What INKVAULT Improves:** Uses W3C PointerEvents (`pointerType`, `pressure`, `tiltX`, `tiltY`, `getCoalescedEvents()`) with explicit **Stylus-Only (Palm Rejection)** toggle so iPadOS Apple Pencil users get zero stray palm marks while desktop/mouse users can write seamlessly when Stylus-Only is off.

### REF-22 — Undo / Redo & Non-Interruptive Autosave
- **Source:** Goodnotes Support — Android/Windows/Web & iOS Toolbar (`https://support.goodnotes.com/hc/en-us/articles/7378598719759-Get-Started-With-Goodnotes-for-Android-Windows-and-Web`).
- **Interface Layout:** Persistent Undo (`⌘Z`) and Redo (`⇧⌘Z`) buttons anchored at the far left of the workspace toolbar, disabled at stack boundaries; silent background saving without blocking "Saving..." spinners.
- **Interaction Patterns:** Tap button, keyboard shortcut, or two-finger/three-finger gesture; autosave commits incrementally in background.
- **Visual Hierarchy:** Subtle non-intrusive saved/synced status indicator in header rather than modal toast spam.
- **What INKVAULT Improves:** Implements deterministic per-document bounded history stack (`100+` steps) covering strokes, partial pixel erasures, lasso transforms, shape edits, text edits, and page mutations, paired with non-blocking debounced IndexedDB persistence and subtle `Saved locally` telemetry badge.

### REF-23 — Toolbar Customization & Overflow
- **Source:** Goodnotes Toolbar Customization walkthrough (`https://chartingdreamsco.com/blog/your-toolbar-your-way-making-goodnotes-work-for-your-specific-workflow`, verified screenshot `goodnotes-6-writing-workspace-toolbar-pe-3.webp`).
- **Interface Layout:** Reorderable tool icons with dynamic overflow menu so power users can hide unused icons or surface favourite tools.
- **Interaction Patterns:** Toggle visibility/position of secondary accessories (`Ruler`, `Tape`, `Zoom Window`, `Laser`) while keeping core ink tools one tap away.
- **Visual Hierarchy:** Keeps toolbar scannable on smaller portrait viewports (`834px` wide iPad portrait) via responsive horizontal scroll/overflow without clipping controls.
- **What INKVAULT Improves:** Adapts cleanly between iPad Landscape (`1194px+`) and iPad Portrait (`768px–834px`) without hiding colour swatches or clipping popovers.

### REF-24 — QuickNote One-Tap Capture
- **Source:** Official Goodnotes QuickNotes page (`https://www.goodnotes.com/features/quick-notes`).
- **Interface Layout:** Single-tap button bypassing cover/title/template dialogs to drop immediately onto a clean default writing sheet titled `Quick Note — <Date>`.
- **Interaction Patterns:** Zero-friction capture; user can rename or move to a folder afterward.
- **Visual Hierarchy:** Prioritizes sub-100ms time-to-first-stroke.
- **What INKVAULT Improves:** Provides a dedicated `Quick Note` button (`Alt+N`) in both the Library header and empty workspace state that creates and opens a ready-to-write sheet in one click.

---

## Category 4: Drawing and Editing Tools (6 References — REF-25 to REF-30)

### REF-25 — Eraser Modes (Precision/Pixel, Standard, Stroke) & Tool Filters
- **Source:** Goodnotes Support — Erasing handwriting and highlighting (`https://support.goodnotes.com/hc/en-us/articles/7353718249231-Erasing-handwriting-and-highlighting`, verified attachments `17117531795983` and `17117531795599`).
- **Interface Layout:** Eraser active menu with mode selector (`Precision`, `Standard`, `Stroke`), 3 eraser radius circles, and `Advanced Settings` popover containing `Eraser Filter` toggles (`Pen`, `Pencil`, `Highlighter`, `Tape`), `Clear Page`, and `Auto-Deselect`.
- **Interaction Patterns:** Stroke eraser removes whole intersected strokes; Precision/Pixel eraser splits strokes along eraser path; turning off `Pen` and leaving `Highlighter` on lets users erase highlights without touching handwriting!
- **Visual Hierarchy:** Crisp circular eraser cursor scaled to page zoom + clear toggle switches in filter popover.
- **What INKVAULT Improves:** Implements **both Stroke Eraser and true Vector-Splitting Pixel Eraser** (splitting `InkStroke` point arrays geometrically rather than rasterizing to bitmaps!), plus per-type **Eraser Filters** (`Pen/Pencil`, `Highlighter`, `Shapes`, `Tape`), `Auto-Deselect` (returns automatically to previous pen!), and `Ignore Locked Objects`.

### REF-26 — Lasso Selection (Freehand & Rectangular) & Universal Object Menu
- **Source:** Goodnotes Support — Select, Move, and Edit Content With the Lasso Tool (`https://support.goodnotes.com/hc/en-us/articles/7353695644175-Select-Move-and-Edit-Content-With-the-Lasso-Tool`, verified attachments `17090624038927`, `17090624039055`, `17090624039823`, `14090466569615`).
- **Interface Layout:** Dashed selection loop/rectangle yielding an immediate bounding box with 8 resize handles, top/bottom rotation stem, and floating **Universal Object Menu** right above the selection (`Cut`, `Copy`, `Duplicate`, `Color`, `Resize/Thickness`, `Convert to Text`, `Group`, `Lock`, `Layer Order`, `Move to Page`, `Delete`).
- **Interaction Patterns:** Object Menu pops up automatically on pointer-up without requiring an extra tap; dragging inside moves; dragging handles scales (with optional constant-stroke-thickness mode!); dragging rotation handle rotates around centroid.
- **Visual Hierarchy:** High-contrast blue selection frame with white circular handles and compact dark/elevated contextual action bar.
- **What INKVAULT Improves:** Adds **Freehand & Rectangular Lasso modes**, filter toggles, **Group / Ungroup**, **Lock / Unlock**, **Layer Front/Back**, **Move Selection to Page...**, **One-Tap Convert to Editable Text Box** (solving the multi-step copy-delete-paste complaint in App Store reviews!), **Save as Sticker/Element**, and **Snap Alignment Guides**!

### REF-27 — Shape Recognition, Geometric Primitives & Diagram Connectors
- **Source:** Goodnotes vs Freenotes Official Shape & Diagram comparison (`https://www.goodnotes.com/blog/goodnotes-vs-freenotes`) & Lasso shape edge editing (`17090736012943`).
- **Interface Layout:** Dedicated Shape & Connector tools (`Line`, `Arrow`, `Rectangle`, `Ellipse`, `Triangle`, `Diamond`, `Connector`) plus automatic `Draw-and-Hold` recognition directly inside the Pen tool, with post-creation control handles and optional fill opacity.
- **Interaction Patterns:** Sketch a rough box/circle/arrow and pause 400ms -> snaps into crisp geometry; select later to drag endpoints/corners or bind diagram connectors between shapes.
- **Visual Hierarchy:** Clean vector stroke with optional translucent fill (`12%` tint) for flowcharts and architecture diagrams.
- **What INKVAULT Improves:** Supports both **Draw-and-Hold** shape recognition directly from freehand ink AND dedicated geometric shapes + **Diagram Connectors** that link between objects/shapes with arrowheads, labels, and editable control handles!

### REF-28 — Movable Text Boxes & Typography Formatting
- **Source:** Goodnotes Support — Type text with the Text Tool (`https://support.goodnotes.com/hc/en-us/articles/7353727615375-Type-text-with-the-Text-Tool`).
- **Interface Layout:** Tap anywhere with Text Tool to place a resizable, rotatable rich text box with contextual typography bar (`Font Family`, `Font Size`, `Bold`, `Italic`, `Underline`, `Color`, `Background Fill / Border`, `Alignment`, `Line Height` — including ruled-paper line-snap!).
- **Interaction Patterns:** Double-tap any text box from any non-drawing or lasso state to edit inline; drag border to reposition; resize width to reflow text smoothly without clipping at page edges.
- **Visual Hierarchy:** Crisp DOM/Canvas-synchronized typography with zero input lag.
- **What INKVAULT Improves:** Eliminates Goodnotes' clunky text-box editing bugs by making text boxes crisp, resizable, background-tintable (doubling as sticky callout notes!), line-height configurable to match ruled paper spacing, and searchable instantly.

### REF-29 — Elements (Stickers) & Image Insertion
- **Source:** Goodnotes Support — Create, Use, and Share Elements (`https://support.goodnotes.com/hc/en-us/articles/7353727577359-Elements-Tool-Enrich-your-Notes`).
- **Interface Layout:** Sticker/Elements popover organized into collections (`Study Badges`, `Callouts`, `Diagrams`, `Custom Saved`) plus direct Image file upload / drag-and-drop onto canvas with aspect-locked or free resize handles.
- **Interaction Patterns:** Tap or drag sticker onto page; select any group of handwriting/shapes with Lasso -> `Save as Sticker` to reuse across all notebooks!
- **Visual Hierarchy:** Vector SVG badges and crisp raster images layered seamlessly with ink so users can write directly on top of inserted images/diagrams.
- **What INKVAULT Improves:** Includes curated professional academic/engineering vector stickers AND user-created custom reusable Elements saved from any canvas selection, all 100% offline-capable.

### REF-30 — Interactive Graduated Ruler & Laser Pointer
- **Source:** Goodnotes Support — Draw straight lines with the Ruler tool (`https://support.goodnotes.com/hc/en-us/articles/8254946748687-Draw-straight-lines-with-the-Ruler-tool`, verified attachments `13832043067663`, `13832043067791`, `8257195528719`) & Keyboard Shortcuts (`L` for Laser).
- **Interface Layout:** Translucent metric/pixel graduated straightedge overlaid on canvas showing angle badge (`0.0°`), drag body, and rotation grips; Laser Pointer renders glowing red/cobalt dot or fading trail.
- **Interaction Patterns:** Any pen/highlighter stroke started within snap distance of the ruler edge projects cleanly onto that exact angle; Laser strokes fade smoothly after ~1.4 seconds without entering Undo history.
- **Visual Hierarchy:** Frosted translucent straightedge lets underlying grid/PDF lines remain visible for precise alignment.
- **What INKVAULT Improves:** Implements both the **Graduated Snap Ruler** (draggable, rotatable via handle or mouse wheel / two-finger twist with `15°` snap option and live angle readout) and **Dual-Mode Laser Pointer** (Dot & Fading Trail) for live walkthroughs.

---

## Category 5: PDF Annotation (5 References — REF-31 to REF-35)

### REF-31 — Direct PDF Import & Multi-Layer Markup
- **Source:** Official Goodnotes PDF Annotation page (`https://www.goodnotes.com/features/pdf-annotation`) & Support (`https://support.goodnotes.com/hc/en-us/articles/7353717816463-Import-files-into-Goodnotes`).
- **Interface Layout:** Imported PDF opens as a first-class notebook where each PDF page retains its exact aspect ratio and sharp typography while accepting handwriting, highlighters, underlines, shapes, text callouts, and images above it.
- **Interaction Patterns:** Import standalone PDF from Library OR insert PDF pages before/after any page inside an existing notebook.
- **Visual Hierarchy:** Crisp PDF vector rendering underneath non-destructive editable annotation layers.
- **What INKVAULT Improves:** Keeps every annotation object 100% vector-editable in INKVAULT (never baked into the PDF background during editing) and supports mixed notebooks combining PDF slides alongside blank/Cornell note sheets for side-by-side lecture notes!

### REF-32 — PDF Outlines & Custom Hierarchical Table of Contents
- **Source:** Goodnotes Support — Create and manage document outlines (`https://support.goodnotes.com/hc/en-us/articles/7353757101071-Create-an-outline`, verified attachments `14652632418831` and `14652663710991`).
- **Interface Layout:** Sidebar `Outlines` tab displaying imported native PDF table-of-contents trees alongside user-created custom outline items with indentation levels and target page numbers.
- **Interaction Patterns:** Click any outline node to jump directly to that page; right-click or click `+ Add Page to Outline` under a thumbnail to create nested outline entries.
- **Visual Hierarchy:** Collapsible chevron tree with active-page highlight bar.
- **What INKVAULT Improves:** Extracts native PDF outlines automatically via `pdfjs-dist` on import AND lets users add, rename, indent/outdent, and delete custom multi-level outline nodes on any notebook or PDF.

### REF-33 — Batch Page Selection, Rotation, Duplication & Deletion
- **Source:** Goodnotes Support — Use the Sidebar to navigate your document (`https://support.goodnotes.com/hc/en-us/articles/9497798035983-Using-the-Sidebar-to-navigate-your-document`, verified attachment `13849987420687`).
- **Interface Layout:** Pages thumbnail grid in Sidebar/Modal with `Select Pages` mode revealing top action bar (`Copy`, `Rotate`, `Export`, `Duplicate`, `Move`, `Move to Trash`) and blue selection checkmarks on thumbnails.
- **Interaction Patterns:** Multi-select pages -> rotate 90° clockwise/counter-clockwise, duplicate slides, delete unwanted pages (with undo/confirmation so users never accidentally lose completed notes as reported in App Store reviews!), or extract selected pages.
- **Visual Hierarchy:** Selected thumbnails show prominent blue border + badge; page numbers sit centered below each card.
- **What INKVAULT Improves:** Adds **Undo support for page deletion/reordering** (fixing a devastating Goodnotes data-loss review complaint!) plus explicit **Merge PDF** and **Split PDF / Extract Selected Pages to New Notebook or PDF** right in the Page Manager!

### REF-34 — Merging & Inserting PDFs into Existing Notebooks
- **Source:** Goodnotes Support — Import files into an existing document & Copy/Move pages (`https://support.goodnotes.com/hc/en-us/articles/7353728016655-Copy-or-move-pages-from-one-document-to-another`, verified attachment `13797192399887`).
- **Interface Layout:** `Add Page / Merge PDF` dialog choosing insertion point (`Before Current Page`, `After Current Page`, `End of Document`) or merging multiple PDFs into one unified notebook.
- **Interaction Patterns:** Select external PDF or existing notebook pages and merge non-destructively while keeping page-specific dimensions intact.
- **Visual Hierarchy:** Clear insertion-position radio pills prevent misplaced pages in 200-page textbooks.
- **What INKVAULT Improves:** Provides dedicated **Merge PDF** (append or insert at current page) and **Split PDF** (split by page range or extract selected pages into a standalone PDF or new INKVAULT notebook).

### REF-35 — Annotated PDF Export (Flattened vs Editable Metadata)
- **Source:** Goodnotes Support — Export All Pages / PDF Data Format (`https://support.goodnotes.com/hc/en-us/articles/7353742854543-PDF-outlines-and-hyperlinks-are-missing-when-I-export-a-document`, verified attachment `11729807106447`).
- **Interface Layout:** Export sheet showing format tiles (`PDF`, `Image`, `Native Archive`), filename input, and granular toggles (`Include Page Background`, `Include Annotations`, `Include Tape Masks`).
- **Interaction Patterns:** Choose All Pages or Custom Page Range, configure toggles, export standards-compliant PDF retaining exact visual layout.
- **Visual Hierarchy:** Card-based format selector at top, clean boolean toggles below.
- **What INKVAULT Improves:** Uses `pdf-lib` to composite vector ink strokes, translucent highlights, shapes, text boxes, and images directly onto original PDF vector pages (keeping original PDF text crisp and selectable!) or rendered paper templates, with optional embedded INKVAULT editable round-trip metadata.

---

## Category 6: Page Navigation (4 References — REF-36 to REF-39)

### REF-36 — Collapsible Left Sidebar (`Pages | Outlines | Audio`)
- **Source:** Goodnotes Support — Sidebar Navigation (`https://support.goodnotes.com/hc/en-us/articles/7353757101071-Create-an-outline`, verified attachment `14652632418831` & `goodnoteseducation.zendesk.com` attachment `17182281470991`).
- **Interface Layout:** Docked left drawer (`280px–320px`) inside the notebook workspace with a 3-way segmented control at top (`Pages`, `Outlines`, `Bookmarks / Audio`) and quick close `×` button.
- **Interaction Patterns:** Toggles open alongside the live canvas so users can jump across chapters/slides without obscuring the full screen in a modal overlay.
- **Visual Hierarchy:** Active page thumbnail has a crisp accent border and auto-scrolls into view as the user navigates.
- **What INKVAULT Improves:** Combines docked **Sidebar Drawer** (`Pages`, `Outline`, `Bookmarks`, `Layers`) AND an expandable **Full-Screen Page Grid Lightbox** for rapid batch rearranging of 100+ page documents!

### REF-37 — Drag-and-Drop Page Reordering & Add Page Slot
- **Source:** Goodnotes Support — Reordering pages in a document (`https://support.goodnotes.com/hc/en-us/articles/7353718659343-Reordering-pages-in-a-document`, verified attachment `13786556900495`) & Add Page (`7438835605391`).
- **Interface Layout:** Numbered page thumbnail grid with bookmark ribbon indicator on bookmarked thumbnails and a persistent `+ Add Page` tile at the end (plus per-thumbnail insert-after trigger).
- **Interaction Patterns:** Drag thumbnail to reorder; click `+ Add Page` to append a sheet matching the current template or choose a new template.
- **Visual Hierarchy:** Clear drop-target indicator and live thumbnail previews reflecting ink strokes on each page.
- **What INKVAULT Improves:** Generates throttled, cached miniature page thumbnails lazily via `IntersectionObserver` / idle callbacks so scrolling a 300-page notebook thumbnail grid stays smooth at 60fps.

### REF-38 — Page Bookmarks & Quick Ribbon Toggle
- **Source:** Goodnotes Support — Use Favorites and bookmarks (`https://support.goodnotes.com/hc/en-us/articles/7353727934095-Use-Favorites-and-bookmarks-in-Goodnotes`).
- **Interface Layout:** Top-right ribbon icon inside workspace header that turns amber/red when the current page is bookmarked, mirrored in the Sidebar `Bookmarks` filter.
- **Interaction Patterns:** One tap bookmarks/unbookmarks current page; optional custom label (`"Exam Formula Sheet"`, `"Sign Here"`) makes bookmarks self-documenting.
- **Visual Hierarchy:** High-visibility warm amber ribbon accent contrasts deliberately with neutral monochrome chrome.
- **What INKVAULT Improves:** Supports both 1-tap Page Bookmarking AND optional **Named Bookmark Labels** filterable in both the Sidebar and Study Set view.

### REF-39 — Continuous Vertical Scroll vs Single-Page / Two-Page Spread Navigation
- **Source:** Goodnotes App Store Reviews & Feature Requests (`https://support.goodnotes.com/hc/en-us/articles/7616167357967-Frequently-requested-features-for-Goodnotes` — noting users' long-standing request for Two-Page Book Spread and quick page-jump scrubber).
- **Interface Layout:** Page counter pill (`Page 4 of 128`) with Previous/Next buttons, direct page-number jump input, zoom percentage control (`Fit Width`, `Fit Page`, `50%–400%`), and view mode switcher.
- **Interaction Patterns:** Keyboard `PageUp`/`PageDown` or `[`/`]`, swipe/buttons, or direct page-number jump for large textbooks.
- **Visual Hierarchy:** Compact floating bottom-right HUD pill that never blocks writing and hides in Zen mode.
- **What INKVAULT Improves:** Provides crisp Single-Page focus view AND Continuous Virtualized Vertical Scroll (for 200+ page notebooks where only visible pages mount high-res canvases!) plus instant Page-Number Jump & Zoom Fit controls.

---

## Category 7: Search and Study Tools (4 References — REF-40 to REF-43)

### REF-40 — Global & In-Document Search Across Handwriting, PDFs & Outlines
- **Source:** Goodnotes Support — Search Sidebar (`https://support.goodnotes.com/hc/en-us/articles/7353757101071-Create-and-manage-document-outlines`, verified attachment `14416802968975`) & Official Comparison (`https://www.goodnotes.com/blog/goodnotes-vs-freenotes`).
- **Interface Layout:** Search input with segmented filter tabs (`All`, `Title`, `Handwriting & OCR`, `Typed Text`, `PDF Text`, `Outlines`) and result cards showing page thumbnail/snippet, match highlight, notebook name, and page number.
- **Interaction Patterns:** Debounced live query -> click any hit to open the target notebook directly at that exact page and highlight matching bounding regions!
- **Visual Hierarchy:** Highlighted query substring in result snippet + source-type pill badge (`Handwriting`, `PDF`, `Text`, `Outline`).
- **What INKVAULT Improves:** Runs **asynchronous background OCR (`tesseract.js` worker + geometric stroke/text indexing)** with an explicit non-blocking OCR queue indicator, image OCR support, rich filter chips, and zero subscription gating on handwriting search!

### REF-41 — Active Recall Tape Tool
- **Source:** Goodnotes Support — Toggle visibility of content with the Tape Tool (`https://support.goodnotes.com/hc/en-us/articles/9489290046607-Toggle-visibility-of-content-with-the-Tape-Tool`, verified attachment `15434579751951`) & Official Blog (`https://www.goodnotes.com/blog/tape-tool-tips-tricks`, `using-tape-tool-in-goodnotes.PNG`).
- **Interface Layout:** Dedicated `Tape` tool in toolbar with colour swatches (`Amber`, `Slate`, `Mint`, `Coral`) and thickness slider; draws opaque rounded-end masking strips over formulas, labels, or diagram nodes.
- **Interaction Patterns:** Tap any tape strip to toggle it from `100%` opaque mask to `18%` ghosted reveal; header quick actions `Reveal All Tape` / `Cover All Tape` reset an entire worksheet for another study pass!
- **Visual Hierarchy:** Subtle serrated/matte tape edge distinguishes interactive active-recall masks from ordinary solid shapes.
- **What INKVAULT Improves:** Implements interactive **Active Recall Tape** with `Reveal All / Mask All` page controls AND 1-click **Convert Tape Masks to Flashcards**!

### REF-42 — Study Sets & Spaced Repetition ("Smart Learn")
- **Source:** Goodnotes Support — Getting Started with Study Sets and Smart Learn (`https://support.goodnotes.com/hc/en-us/articles/7353756529551-Getting-Started-with-Study-Sets-and-Smart-Learn`, verified attachment `13833984547215`) & App Store review critique (`https://apps.apple.com/cz/app/goodnotes-6/id1444383602?l=cs`).
- **Interface Layout:** Dedicated Study Set view showing deck mastery bar, searchable card list (Question + Answer + optional diagram image), and interactive Review mode with flip animation and recall rating buttons (`Again`, `Hard`, `Good`, `Easy`).
- **Interaction Patterns:** Flip card (`Space`), grade recall (`1–4`), schedule next review interval automatically; import/export `.csv` / `.tsv` decks.
- **Visual Hierarchy:** Clean centered flashcard focus during active recall session, with transparent mastery metrics (`Due Today`, `Mastered %`, `Next Interval`).
- **What INKVAULT Improves:** Fixes the exact flaws cited in Goodnotes App Store reviews: (1) cards are **searchable and editable inline even during Study Mode**, (2) cards support **both text AND image/diagram snapshots together** on the same card, (3) exposes transparent SM-2 interval statistics, and (4) stays non-intrusively optional.

### REF-43 — Highlight & Lasso Extraction to Study Material
- **Source:** Goodnotes Support — Study Sets Split View & Frequently Requested Highlight Extraction (`https://support.goodnotes.com/hc/en-us/articles/7616167357967-Frequently-requested-features-for-Goodnotes`).
- **Interface Layout:** Action button inside Highlight/Lasso/Sidebar (`Extract Highlights & Annotations` / `Add to Study Set`) compiling highlighted PDF/text passages, bookmarked pages, and lassoed ink snapshots into structured study cards or summary notes.
- **Interaction Patterns:** One-click extraction instead of awkward Split-View manual copy-pasting.
- **Visual Hierarchy:** Clean extraction preview modal letting the user review and edit generated flashcards before saving.
- **What INKVAULT Improves:** Ships native **Highlight & Annotation Extraction** directly into Study Sets or Markdown/Text export — fulfilling one of Goodnotes users' top requested features!

---

## Category 8: Audio and Collaboration (3 References — REF-44 to REF-46)

### REF-44 — Audio Recording & Continuous Tab Indicator
- **Source:** Goodnotes Official Audio Recording (`https://www.goodnotes.com/features/audio-recording`) & Support (`https://support.goodnotes.com/hc/en-us/articles/7352668634127-Continuous-Audio-Recording`, verified attachment `13849987424143`).
- **Interface Layout:** Microphone record button in workspace bar expanding into a compact live timer pill (`00:42`) with `Pause / Resume` and `Stop` controls, live waveform meter, and pulsing red indicator on the active document tab.
- **Interaction Patterns:** Record continuously while writing across pages in a notebook; pause during breaks and resume seamlessly; zero artificial 20-minute free-plan limit.
- **Visual Hierarchy:** Restrained crimson recording dot + tabular monospace timer keep recording status unmistakable without covering the page.
- **What INKVAULT Improves:** Unlimited local audio recording sessions with Pause/Resume, live WebAudio level visualization, multiple named sessions per notebook, and individual `.webm`/`.wav` audio export.

### REF-45 — Synchronised Audio Playback & Handwriting Timestamp Replay
- **Source:** Goodnotes Support — Add Audio Recordings to your documents (`https://support.goodnotes.com/hc/en-us/articles/7352688559631-Add-Audio-Recordings-to-your-documents`, verified attachments `13849987447695` and `13849987447951`) & `https://www.goodnotes.com/features/audio-recording`.
- **Interface Layout:** Audio drawer/bar displaying session selector (`Audio Session 1..N`), playback speed pill (`0.75×–2.0×`), `-10s`, `Play/Pause`, `+10s`, interactive scrub timeline with stroke-activity markers, and `Tap Ink to Seek` toggle.
- **Interaction Patterns:** While replaying audio, strokes written during that session highlight/animate at their exact `audioOffsetMs` timestamp; tapping any synced handwritten stroke jumps playback directly to the moment that stroke was written!
- **Visual Hierarchy:** Future strokes render softly dimmed (`30%` opacity) during Ink Replay and snap to `100%` crisp opacity with a brief cobalt highlight pulse as the playhead crosses their timestamp.
- **What INKVAULT Improves:** Implements real bidirectional **Handwriting-to-Audio Timestamp Sync** across all platforms (not restricted to Apple-only devices like Goodnotes' Note Replay!).

### REF-46 — Document Sharing & Collaborative Annotations
- **Source:** Official Goodnotes Collaboration (`https://www.goodnotes.com/features/collaboration`) & Support (`https://support.goodnotes.com/hc/en-us/articles/13682950187279-Share-documents-privately-and-collaborate-in-real-time`, verified attachment `13850197525519`).
- **Interface Layout:** `Share & Export` modal with `Shared` status toggle, collaborator permission list, shareable portable snapshot/package link, and `Shared` filter section in the Library sidebar.
- **Interaction Patterns:** Mark notebooks as Shared, attach author/reviewer metadata on annotations, export/import collaborative `.inkvault` packages, or sync across devices via configurable sync endpoint.
- **Visual Hierarchy:** Subtle collaborator/shared badge on Library card and clear separation between private local vault vs explicitly shared documents.
- **What INKVAULT Improves:** Keeps sharing strictly opt-in under a local-first privacy model — zero forced cloud account creation to use your own notebooks.

---

## Category 9: Settings, Backup and Export (4 References — REF-47 to REF-50)

### REF-47 — Cloud & Auto-Backup Status Popover
- **Source:** Goodnotes Support — Use Auto Backup (`https://support.goodnotes.com/hc/en-us/articles/7352786555279-Use-Auto-Backup-to-automatically-create-a-copy-of-your-documents-in-a-supported-cloud-storage`, verified attachment `13727223996047`).
- **Interface Layout:** Top-bar cloud status popover divided into `Cloud Sync` (`Last sync timestamp`, `Sync Now` action) and `Auto Backup` (`Library Backed Up`, `Last backup timestamp`, `Settings >`).
- **Interaction Patterns:** One-tap health check showing exact last local save, last backup export, and sync queue state without vague spinners.
- **Visual Hierarchy:** Green check badges for healthy states, amber conflict badges when divergent edits require user resolution.
- **What INKVAULT Improves:** Provides a transparent **Storage & Sync Telemetry Popover** showing real IndexedDB usage, encryption status, version snapshot count, `Backup Library Now`, and honest sync conflict resolution (`Keep Local`, `Keep Remote`, `Keep Both`).

### REF-48 — Backup Format & Goodnotes `.zip` Archive Behaviour
- **Source:** Goodnotes Support — Backup settings & `.zip` structure (`https://support.goodnotes.com/hc/en-us/articles/7352773502351-Backing-up-my-Audio-Recordings`, verified attachment `7436845086607` & `https://support.goodnotes.com/hc/en-us/articles/7353742233359-I-cannot-view-the-Goodnotes-backup-zip-file-on-my-computer`).
- **Interface Layout:** Backup configuration choosing format (`Native Archive`, `PDF`, or `Both`), excluded folders, and manual `Back Up Now` / `Restore Backup` controls.
- **Interaction Patterns:** Exports a single complete `.zip` archive of the entire library; Goodnotes `.zip` files notably cannot be inspected easily on a desktop unless exported with PDFs.
- **Visual Hierarchy:** Grouped settings form with clear format descriptions.
- **What INKVAULT Improves:** `.inkvault-backup.zip` archives use an **open, documented, human-inspectable JSON + standard binary assets (`pdfs/`, `audio/`, `images/`) layout** (optionally AES-256-GCM encrypted when locked!) AND INKVAULT's dedicated **Goodnotes Migration Studio** ingests Goodnotes `.goodnotes`, `.pdf`, and `.zip` backups with honest, itemized preservation reports!

### REF-49 — Export Modal (PDF, PNG/Image, Native Archive)
- **Source:** Goodnotes Support — Export All Pages (`https://support.goodnotes.com/hc/en-us/articles/7353742854543-PDF-outlines-and-hyperlinks-are-missing-when-I-export-a-document`, verified attachment `11729807106447`).
- **Interface Layout:** Multi-format export dialog (`PDF`, `PNG Images`, `INKVAULT Editable Archive`, `Markdown/OCR Text`) with page-range selector (`All Pages`, `Current Page`, `Custom Range`) and layer inclusion switches.
- **Interaction Patterns:** Instant local file generation and browser/OS download with progress indicator for large multi-hundred-page PDFs.
- **Visual Hierarchy:** Primary format tiles at top, fine-grained inclusion toggles below, prominent `Export` CTA.
- **What INKVAULT Improves:** Adds **OCR Text / Markdown Export** alongside high-DPI **PDF**, **PNG**, and lossless **`.inkvault` Archive** exports.

### REF-50 — Comprehensive Settings & Privacy Control Center
- **Source:** Goodnotes Official App Store & Keyboard Shortcuts / Account Settings (`https://support.goodnotes.com/hc/en-us/articles/17220521238159-Keyboard-Shortcuts-in-Goodnotes` & `https://www.goodnotes.com/blog/best-free-note-taking-apps-for-students-2026`).
- **Interface Layout:** Tabbed Settings modal covering `Appearance`, `Pen & Stylus Preferences`, `Storage & Performance`, `Backup & Restore`, `Synchronisation`, `Import & Goodnotes Migration`, `Privacy & Encryption`, and `Account / Ownership`.
- **Interaction Patterns:** Immediate live application of theme, palm rejection, default pen smoothing, pressure curve, autosave interval, and encryption controls.
- **Visual Hierarchy:** Left vertical category rail + right structured control groups with concise explanatory captions.
- **What INKVAULT Improves:** Enforces **100% local ownership** — zero forced sign-in, zero 3-notebook limit, zero 5MB PDF import limit, zero 20-minute audio cap, real WebCrypto AES-256-GCM encryption, and full Version History snapshots built directly into local storage.

---

## Summary of Design & Product Decisions Driven by This 50-Reference Audit

| Pain Point Identified in Goodnotes 6 Audit | INKVAULT Architectural & UX Solution |
| --- | --- |
| 3-bar top header consumes ~135px vertical writing space | Compact 2-bar precision chrome + 1-click Zen Focus mode |
| Artificial free limits (3 notebooks, 5MB PDF, 20m audio) | Unlimited local notebooks, unlimited PDFs, unlimited synced audio |
| Trash hidden inside Settings gear popover | Dedicated `Trash` & `Recent` items directly in Library sidebar |
| Only 3 pen thickness slots & pastel-heavy visual noise | 5 width slots + 8 colour swatches + saved instrument presets; monochrome architectural aesthetic |
| Clunky multi-step handwriting-to-text conversion | 1-tap `Convert to Editable Text Box` right in the Lasso Object Menu |
| Page deletion lacks easy undo / accidental note loss | Full Undo/Redo & Version History snapshots + soft-delete recovery |
| Flashcards cannot be searched/edited mid-study or mix image+text | Searchable, inline-editable SM-2 flashcards supporting text + diagram snapshots + highlight/tape extraction |
| Opaque proprietary `.goodnotes` lock-in | Open documented `.inkvault` portable schema + honest Goodnotes Migration Studio |
