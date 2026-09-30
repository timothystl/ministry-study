# Scope: Illustration & Idea Collector and Visual Collector

Two new pages in the study, built the same way Children's Messages was: a focused page over records
the study already knows how to store, search, back up and share. Nothing here needs a new service.

## Principles

1. **Capture in ten seconds, sort later.** Most ideas arrive on a phone, mid-conversation or
   mid-book. Adding one must never require more than a few words.
2. **Keep where it came from.** Every item records its source, so it can be cited, credited or found again.
3. **Surface, don't shelve.** The collector earns its keep when a sermon on Luke 15 shows what is
   already collected for Luke 15. A pile that can only be searched by memory is a junk drawer.
4. **Private by default when it is about people.** Pastoral stories and photos of members follow the
   funeral/wedding rule: out of search and out of review packages until switched on.
5. **Rights are a field, not an afterthought.** Every image and clip carries its license.

---

## 1. Illustration & Idea Collector

### What goes in

| Kind | Example |
| --- | --- |
| Story | A hospital hallway moment, a childhood memory |
| Quote | A line from Dillard, Eliot, Wright, with book and page |
| Image / metaphor | "The junk drawer that holds every key to a house you no longer own" |
| Fact or statistic | An economics or psychology finding, with its source |
| News or culture | A headline, a film scene described in words, a song lyric |
| Sermon seed | A half-idea: "Jonah as a man who wins the argument and loses the city" |
| Prompt / question | A question worth building a message around |

### Fields

- **Gist** (required): one line, the thing you would search for.
- **Full text**: the story or quote, as long as needed.
- **Source**: book (linked to the Library, with page), URL, person, "overheard," "my own."
- **Scripture**: one or more passages; uses the existing reference parser so Luke 15 finds Luke 15:11-32.
- **Themes / tags**, plus an optional **wound** it touches (from the Anatomy of Condemnation palette)
  and a **gospel handle** (how it turns toward Christ).
- **Fits**: adult sermon, Bible study, chapel, pre-K message, bulletin.
- **Use history**: which sermon, which date. Shows "used 3 times, last Lent 2026" and can hide items
  used recently.
- **Privacy**: Personal / pastoral (default off in search and review packages) or Shareable.

### Capture

- Big "Add" button on every page of the app, and a phone-first quick-add form (gist, paste, done).
- Paste a URL: the title is fetched and filled in.
- Quote from a Library book: pick the book, type the page; the record links back to it.
- Photo of a page or whiteboard, kept as an attachment (typing the text can wait). Reading text out
  of the photo is a possible later step.
- Import: bring in the existing Illustration and Idea notes, and paste-in lists.

### Retrieval

- Search across gist, text, source and tags; filter by kind, theme, fit, used/unused, private/shareable.
- **On a sermon's page:** a "Collected for this passage" panel, matching by Scripture and theme.
- **Random pull:** "show me three unused things" for a dry week.
- **Export for an outside read:** the same package pattern Sermons → Review uses, so a Claude
  pass can suggest tags, connections and gospel handles that Andrew approves field by field.

### How it is built

Extends the existing notes records (they already have Illustration and Idea kinds, tags, scripture and
sermon links). Adds optional fields (source, linked book, page, wound, fits, uses, privacy) so nothing
existing breaks. New page, new switch on People for who may use it.

---

## 2. Visual Collector (images and movie clips)

### What goes in

- **Images:** photos, paintings, icons, graphics, slide backgrounds, bulletin art.
- **Clips:** film and TV scenes, video illustrations, worship-background loops.

### Fields

- **Title, kind, thumbnail.**
- **Source URL and creator.**
- **License** (required): Public domain, Creative Commons (which), Licensed through the church
  (Church Video License or similar), Own work, Fair-use / unverified. Plus **attribution text** ready
  to paste onto a slide or into a bulletin.
- **Scripture, themes, tags**, same as illustrations.
- **Use for:** sermon slide, bulletin, chapel, pre-K, website, worship background.
- **Where the file lives:** attached in the study, a link, or "on the church computer at (path)."
- **For clips only:** start and end time, duration, one sentence of what happens, the sermon point it
  serves, and a **content note** (language, violence, grade suitability).
- **Linked illustration:** a clip or image can hang off a story or quote, so the words and the picture stay together.

### What gets stored, and where

| Item | v1 | Later |
| --- | --- | --- |
| Images | Attached in the shared database (already handles photos up to 6 MB, shrunk automatically) | Move to Cloudflare R2 if the collection grows large |
| Clips | **A link, not a file:** YouTube/Vimeo embed with start/end time, or a note of where the file is | Upload short clips to R2 |
| Film scenes | Title, film, timestamp, scene description, where it can be legally shown | Nothing more: we do not rip or copy streaming video |

Reasoning: the database used for attachments is built for small files. Video would fill it quickly and
hit Cloudflare's free-plan limits, so v1 treats clips as pointers with good notes. That already covers
the real need (remembering *which* scene, *when*, and *why*).

### Finding material

Search boxes inside the page for sources that publish clear licenses, each opening in a new tab and
letting you paste the result back with the license filled in:

- Wikimedia Commons (license is machine-readable, so it can auto-fill)
- Met Museum and National Gallery of Art open-access collections (public domain)
- Unsplash, Pexels, Pixabay (free-use photos; terms noted per site)
- Library of Congress (check each item's rights statement)

Pasting a YouTube or Vimeo link fills title and thumbnail automatically.

### Views

Grid of thumbnails (like Library covers), filter by kind, license, use, theme, scripture. On a
sermon's page: "Images and clips for this passage." A **slide-ready copy** button gives the title,
credit line and link in one paste.

### Rights and safety notes

- Church use of film clips generally depends on the church's umbrella license or on the clip's own
  terms. The app records what the license is; it does not decide. **Andrew to confirm which license
  Timothy holds** so the "Licensed through the church" option is labeled correctly.
- Photos of children and members: private by default, and a reminder to check the photo-release policy.
- No downloading or converting of streaming or copyrighted video.

---

## Shared pieces

- **One combined capture button.** Adding either kind starts from one place.
- **Links between them:** an illustration can have images and clips; a sermon lists both.
- **Backup and sharing:** included in the JSON backup and the shared database; media files stay
  outside the backup (as hymn attachments do today).
- **People and permissions:** two new switches, "Illustrations & Ideas" and "Visuals."

## Phases

| Phase | Delivers | Size |
| --- | --- | --- |
| 1 (built) | Illustration & Idea page: quick add, fields, search, filters, private handling, import of existing notes | Small–medium |
| 2 | "Collected for this passage" on sermon pages; use history; random pull | Small |
| 3 | Visual Collector: images with license fields, clip links with start/end and content notes, grid, filters | Medium |
| 4 | URL and Commons metadata fill, YouTube/Vimeo thumbnails, slide-ready credit copy | Small–medium |
| 5 (later) | R2 uploads for clips and large images; text from photographed pages; Claude tagging pass through the review package | Medium |

Phases 1 and 3 are the ones that change daily work. The rest can wait on how the first two feel.

## Decisions (from Andrew)

1. Illustrations get **their own page** (built; same records as Devotions & Notes).
2. Clips start as **a link with notes**; a player can come later.
3. Timothy holds a **CVLI** license. Some material is **personal reference, not public display**, so
   each item needs a "for reference only / not for display" marker alongside the license.
4. No favorite sources to add as search shortcuts yet.
5. The existing collection is **very little, some handwritten, some scraps**. Capture matters more
   than import: quick one-line add and photographing scraps come first (built).
6. **Just Andrew** uses these, so nothing about sharing between people is needed now.
