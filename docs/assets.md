# Visual assets

The visual reference is [chosen-design.png](chosen-design.png), the design supplied on September 28, 2026 (illustrative sample content only).

The banner and generic unidentified-book cover were generated with built-in Image Gen, using the supplied design as the visual reference. They are individual image assets, not screenshots used as UI. `public/assets/mountain-banner.png` is 2172×724; `public/assets/unidentified-cover.png` is a front-on, unlettered cloth book and must not be represented as an identified edition.

Sample book artwork is retrieved bibliographic cover imagery, not AI-generated editions. Copyright in those covers remains with the respective owners. The art may differ from the illustrative covers drawn in the user's mockup. Bibliography stays tied to the retrieved edition; these samples never imply user ownership.

| Local asset                  | ISBN          | Retrieved source                                                                                       |
| ---------------------------- | ------------- | ------------------------------------------------------------------------------------------------------ |
| `public/assets/surprised-by-hope.jpg`      | 9780061551826 | https://www.bookexpress.nz/cdn/shop/files/5741ad_470fc169-770f-4460-b128-9a6beda76743.jpg?v=1765316442 |
| `public/assets/cross-of-christ.jpg`        | 9780830833207 | https://covers.openlibrary.org/b/isbn/9780830833207-L.jpg?default=false                                |
| `public/assets/biblical-greek.jpg`         | 9780310514466 | https://bt-migration-all-mp3s.s3.amazonaws.com/BT_Book_Covers/9780310514466.jpg                        |
| `public/assets/new-testament-theology.jpg` | 9780802806802 | https://covers.openlibrary.org/b/isbn/9780802806802-L.jpg?default=false                                |
| `public/assets/meaning-of-marriage.jpg`    | 9781594631870 | https://covers.openlibrary.org/b/isbn/9781594631870-L.jpg?default=false                                |
| `public/assets/gentle-and-lowly.jpg`       | 9781433566134 | https://covers.openlibrary.org/b/isbn/9781433566134-L.jpg?default=false                                |

Metadata checked against Open Library's edition record for Surprised by Hope, IVP, Bill Mounce/Biblical Training, Eerdmans, Penguin Random House, and Crossway pages. No inferred edition art is automatically assigned to the real imported catalog. Users can enter an HTTPS cover image URL in Edit Book.

Roboto UI text and Georgia display text match the reference's compact sans-serif and traditional serif hierarchy. Lucide's outline book, search, list, users, bookmark, settings, and editing icons match the reference's line-icon family; semantic status and rating colors follow the supplied mockup.

The mockup's Reports and Amazon tab are not built. Barcode scanning (Scan a Book) and Amazon wishlist import were added after v0.1 and are described in [FEATURES.md](FEATURES.md).

`public/assets/banners/*.jpg` are 2172×724 crops of free-license (Unsplash License) landscape photographs obtained through Lorem Picsum, used as rotating dashboard banners.
