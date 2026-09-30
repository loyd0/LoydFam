# Property images and map review

Reviewed 30 September 2026. Three GPT-6 Luna agents handled bounded archive searches and the property map; the primary agent checked sources, image identities and rights, corrected map behaviour, and integrated and verified the result.

## Published coverage

- 53 researched property accounts remain in the collection.
- 16 credited, locally served images across 12 accounts: eight existing images plus eight additions.
- 42 external archive image, portrait, catalogue and illustration references across 20 accounts. These are not 42 freely reproducible photographs.
- 52 mapped records: eight verified building positions, three approximate estate positions, and 41 approximate localities. Idaho remains unpinned because its location is unresolved.

New displayed material includes Samuel Rawle’s 1806 engraving of Albyns; Samuel Jones-Loyd’s painted and photographic portraits; portraits of Robert and Harriet Loyd-Lindsay including an 1865 photograph reproduced in the 1907 Wantage memoir; the IWM portrait of Henry Charles “Budget” Loyd; and Leighton’s portrait of Ellinor Guthrie, an earlier owner associated with Upper House. Images are captioned by subject and period: portraits are not presented as building photographs, and Guthrie is not presented as a Loyd.

Archive links include eleven 1981 views of Ballogie’s demolished predecessor, two Tormore working-life photographs, The Oaks interior, National Portrait Gallery family photographs, and Historic England photographs, drawings and sale material. The original Ballogie house is distinguished from its modern replacement. Unidentified Tormore sitters are not labelled as family members. Blaenos and Threepwood records retain their identity caveats. The Kings Walden entry is an illustration reference, not a verified photograph.

## Rights and availability

Every displayed image has a source, credit, rights link, stored dimensions and local WebP file. New displayed works are public-domain or CC0 material; existing Creative Commons images retain attribution and licence links. Restricted or unverified reproduction rights are handled with external archive links, not copied files. The gallery supports enlarged viewing, previous/next controls, keyboard navigation and mobile screens.

Some archives provide only catalogue descriptions. Historic England reported an image-service outage during the review. Canmore's specific Ballogie collection identifiers were checked against its site catalogue, but migrated Trove item pages could not be retrieved by the research tool. Those links are retained as catalogue references, with no claim that each image is currently viewable online. No authenticated reusable portrait was established for Arthur Heneage Loyd or James Dyce Nicol. This pass does not claim complete visual coverage of every property or person.

## Map evidence and interaction

`src/content/property-locations.json` stores the precision, explanatory note, research source and location source for each pin. Verified building positions use Historic England grid references. Estate positions identify an estate point or surviving associated structure, not necessarily the original mansion. Locality pins are visibly approximate and must not be used as exact property addresses.

The collection has searchable map/list views, grouped nearby points, zoom and fit controls, evidence links and property-page navigation. Each property page includes its own map or an uncertainty notice. The family-event map links into the property map. Mobile users can switch between the map and an accessible property list.

## Verification

- 35 automated tests passed, including image/source integrity and map evidence validation.
- Type checking, ESLint and the production build passed.
- Authenticated HTTP checks passed for all 53 property pages and all 16 local images, property search, linked profiles, unknown-page handling and unauthenticated access restrictions.
- Browser checks at 320px, 390px and desktop widths covered image enlargement/navigation, map search and selection, persistent zoom, single-property selection, Idaho's unpinned state and horizontal overflow.
- The review found and fixed map zoom resetting during marker regrouping and single-property marker selection hiding the mobile map.

The compilable content and image evidence are in `src/content/properties.json`, `src/content/property-locations.json` and `public/properties/`; working research notes remain in the ignored `.research` directory.

Preview published at https://loyd-family-preview.vercel.app/properties after 16 authenticated live checks passed. Deployment: `dpl_FWC7JrXKdNGK3hetkLHwmJ6itYcz`. Existing preview protection is retained.
