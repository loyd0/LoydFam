# Access permissions

Administrators manage access at **Admin → Permissions**. Administrators retain full access. Non-admin users inherit the default policy; each user can override an individual permission with Allow or Deny, or return to Inherit.

Permissions cover the dashboard, person profiles, tree, family map, property research, mind map, timeline, statistics, generations, fan chart, relationship finder, editing people, editing property research, managing person media, editing notes, source downloads, bulk exports and history. Editing requires access to the corresponding content. User management and permission administration remain administrator-only.

These are section and action permissions per user, not rules hiding individual people or individual fields. A person’s name and dates can still appear in a permitted family tree or relationship result even when their full profile section is unavailable. Historical names appearing in permitted property research remain part of those articles. Publicly licensed property illustrations are public assets.

The server enforces permissions on pages, APIs, downloads and mutations. Hidden navigation is a convenience, not the security boundary. Existing authenticated sessions read the current policy; a new sign-in is not required. Permission changes use version checks to prevent one administrator overwriting another’s changes, and record the actor and before/after values in the audit history.

Initial defaults preserve access to the family browsing sections. Editing, raw source downloads, bulk exports and system history require an explicit grant. Administrative account and security records remain private to administrators.

Starting-person defaults are separate from account identity: William Loyd (`LOYD:1`) starts family views unless an explicit selection is supplied. Relationship comparisons start with the account’s linked person (falling back to William when unlinked), opposite William. No account is automatically linked to William.
