Key technologies:

- Astro 6
- Cloudflare Workers to host it
- Server Side render on demand
- Agressive cache (we will talk about this later)
- Payload CMS as backend
- Svelte 5
- Bits-UI svelte headless components
- SCSS
- Based on patterns from "martyrio" project, for both Payload CMS and Astro frontend
- Three.js 
- Swiper.js
- astro-ceo
- PNPM, for both astro and payload. Check if the PNPM version is saved somehow in package.json or something. I know that for node we use .node-version or something like that in the root folders, and our system uses "fnm" for it. I dont know if in our system we simply go with the pnpm version we have installed or if we follow some similar workflow.

Important note: NEVER READ .env files. Only .env.example or related, if they exist and only if you need it.
# Intro
mönk is a creative studio portfolio. Me, Alejandro, as Creative Engineer. Ahmad, as Brand Designer. Madina, as UI/UX Designer.

Our site shouldn't be complex, but every detail should be carefully crafted and working across every modern browser and device. Code should be elegant, composable, straightforward. We only get pragmatic if the situation calls for it (should be an exception, not the rule), without overthinking it.

Our baseline of good patterns should  be our previous "martyrio" project, available at ~/martyr/martyrio/web for the frontend and  ~/martyr/martyrio/cms for the backend.

For everything I'm saying here, you will verify everything by searching in the codebase, use your own logic, refer to what i've said here, check in the internet, use Context 7 MCP to fetch information about libraries, frameworks, etc. You will ASK questions, if in doubt, and counter argument when you feel the need to do it.

You will help me in setting the foundations, patterns and logic. When it comes to actual styling, unless I told you so, I will do it myself, as I get a better sense of style and translation from the Figma projects I've been provided with and what CSS structures I do need to implement things like grids, headers, etc. You are pretty good at logic, and if I need something specific, i will told you so. In this foundational part, you will help me heavily when it comes to it. 

Use \/superpowers to plan properly for this. Crafting an intricate plan is KEY for the success in bootstrapping this.

In martyrio/web and martyrio/cms you have CLAUDE.md which might be pretty useful as well to craft our proper CLAUDE.md files. 

I would like to keep following the structure of having the CMS in one folder and git tracked on its own, and the frontend in another folder and git track/repo. Keep in mind, there might be older patterns or things we don't need anymore.

Some docs from both the martyrio/web and cms are up to date. Some snippets might be slighly out of date.

Typescript will be heavily used in both projects, whenever possible. In Astro, AFAIK, only content from the `public/` folder, as it won't be processed, should be in pure javascript. I'm not sure we will need that to be honest.


# How to proceed with frontend

There are differences that we should heavily keep an eye on in how to implement our project, compared to `martyrio/web/`

`martyrio/web/` makes heavy usage of javascript maps to
- fetch data from different sources, in this case Shopify + the CMS. We do this to fetch the biggest amount of data in the least amount of network trips
- site is staticaly generated first. Cloudflare builds it automatically when detects new commits at "main/master" at github private repo of this frontend, and also from webhooks triggered from updates from the CMS, which gets webhooks from updates as well from Shopify.
- Because of it, building each page and doing network requests per-route would considerably make the build times so long for no reason. That's why we do that, we cache the network requests, and re-use it in every route we generate at build time so it acts fast

The approach for this new mönk frontend should be different in that matter:
- We don't use Shopify at all. We will only use the CMS as backend info
- We will use a pattern of setting clever cache-tags in a per-page/route basis, compatible with Cloudflare.
- We will utilize Cloudflare's "Smart Tiered Cache" to maximize cache hit ratios and minimize origin requests to the Germany VPS.
- When content is updated in the CMS, we will trigger a global purge of the specific cache-tags to ensure all PoPs and Upper Tier hubs are invalidated.
- We will use the new Live Content Collections pattern and API from Astro 6. So, we only fetch the data we need when requested from a particular page. Live Content Collection, AFAIK, is the layer that will fetch the data coming from our Payload CMS instance, AFAIK.
- In `martyrio/web/`, scripts, CSS files, and assets such as static images are indefinitely cached, as they are mostly generated at build time and hashed in their filename. Only routes that generate API "json" files are not necessarily hashed sometimes, and they are excluded from being cached. We need to keep this in mind in our project if we need similar patterns like that.
- likewise, HTML pages are cached for, I think, 600 seconds. This is due to have ClientRouter enabled to provide seamless, almost instant page transitions across routes. It handles preloading routes with standard browser features. We will maintain a short browser cache/must-revalidate pattern to keep preload features working while relying on CDN Cache-Tags for instant updates.

Our `martyrio/web/` project uses Astro 5. We need to study what changed from Astro 6, although should not be that much.  Maybe there are some clever new patterns that we can use to simplify/optimize our work and pipeline. So, it's better that we keep up with the last changes. In particular, with this: https://astro.build/blog/astro-6/, as there are plenty of changes targetting Cloudflare first-party support, which might become handy as we use Cloudflare across our project.

`martyrio/web/` uses `oxlint` and `oxfmt`. For now, we will skip it. `Vite Plus`  will incorporate all these tools in a comprehensible package in the future, but support for a painless transition while using Astro is still pretty immature. For simplicity, we will use simpler Astro/Svelte native workflows.
#### SCSS
Check for the following from `martyrio/web/`
- layers.scss
- base.scss
- colors.scss
- mixins.scss
- some utilities.scss or something like that
- a reset.scss i think

Those patterns are clean. From colors we get to tweak particular colors, with a defined structure when it comes to variable names and such.

- Layers control the layers CSS properties. 
- Base is where we set standard styles for raw HTML tags and variables
- In this particular page, we don't need the crazy coloring system where we have a particular mixins and functions. We did that on martyrio because we have a global page color picker where users can choose their own color of the page, and almost every color should be decided smartly upon it. Here, our colors are static. Not even a dark or light theme. Just a dark theme with configurable variables for components and such.
- Utilities, as name implies, are pieces of code that might be shared across different pages/components and and can be called from a particular class.
- They all serve proper overrides following layers.scss and natural scoped CSS/SCSS from Astro and Svelte components and \<style\> tags (they all are scoped by nature)

#### Bits-UI
We use bits-ui headless, unstyled components because they solve interesting challenges when it comes to accesibility, and a good foundational base to base our custom styles and patterns. We won't copy every component we have at `martyrio/web` to our project. However, we must keep the pattern from Button.svelte as it is one of the most important ones. It features different types of buttons, CSS patterns to configure animations on hover, on touchdown/up for mobile, etc. It is clean, easy to understand, extendable. Our buttons types are going to be vastly different, so we should start from clean slate, only with the foundational structure from it to build upon it, including the mixin/funcions or whatever we used to target hover/non-hover devices, making it less verbose, and such.
From there, if we need a particular bits-ui pattern, I will call for it. Just keep that in mind.

#### Astro SEO
Same patterns from `martyrio/web`, so far. They are clean and most of it (if not all) should be applicable in this web as well.
#### Icons
This is another pattern we should copy from `martyrio/web/`
- The same foundational library to manage icons on-demand when included in the files, which is unplugin-icons/vite (from astro.config.ts, figure out which library it is)
- I'm not sure if we are going to use any of those icons at all or custom SVGs crafted by our designers, but still, keep it there just in case
- What we will definitely use is our custom Icon.svelte component, so we can call any type of SVGs/icon component/image, whatever we need with it.

#### Swiper.js
Will be used in an extremely similar way as MediaCarousel.svelte component. In fact, I don't know if there will be any differences at all, structure, feature, css wise. We should have it as-is, with its Slide.svelte. 

#### Three.js
Not that many details from it. This will be expanded upon project gets mature.

#### Cloudflare
All i've said about cloudflare so far applies. You should check more in Astro's official documentation and Cloudflare own's documentation about anything we might need to properly assess what we need and how to proceed correctly, what tools, etc.

#### Payload schema

AFAIK, in package.json of this frontend or in CMS, there is a command to sync the types from payload to our astro project. Preserve that, if needed.

#### Update dependency doc

there is a particular doc called updating-dependencies.md, which we should definitely have it a look. Beware though that it might be far simpler, because `martyrio/web` has far more tooling that we will use in this project. I don't know if we need to handle node and pnp versions for cloudflare in the way it is described there. I know I was handling secrets and env vars manually from the cloudflare dashboard web, instead of using wrangler or any CLI tools they use, because i didn't took the time to incorporate or learn it. But if we have a proepr workflow to do everything or as much as possible from our local dev env, without having to go to the dashboard, that would be awesome.

# Backend
You will notice that plenty of stuff is configurable in the same frontend directory from `martyrio/web/`, leaving the backend only to hold information and content mostly. This is intentional, as i'm mostly managing the website on my own and if i need to make changes, i dont need to go and implement an intricate way in the CMS to do it. I just change the lines of code/config variables from the frontend, push the changes, and that's it.

This project is different. Although the most complex stuff we will keep manual configurations in the frontend, we will have more leverage from the backend.

Backend will use Payload CMS in pretty similar ways we have in `martyrio/cms/`

- We will use the LexicalEditor in some places
- In the case of this project, do read irts `docs/` folder as it has crucial information we should keep for our project as well
- We will use the  "drafts" feature in payload CMS. This is NOT being used in our martyrio/cms. We should use it here. Check their docs for more info about it. "Versions with Drafts" I think is a key phrase related to it. "Drafts rely on Versions being enabled in order to function."
- We will use "preview" feature of payload as well:
	- Preview is a feature that allows you to generate a direct link to your front-end application. When enabled, a "preview" button will appear on the Edit View within the [Admin Panel](https://payloadcms.com/docs/admin/overview) with an href pointing to the URL you provide. This will provide your editors with a quick way of navigating to the front-end application where that Document's data is represented. Otherwise, they'd have to determine that URL themselves which is not always straightforward especially in complex apps.
	- The Preview feature can also be used to achieve something known as "Draft Preview". With Draft Preview, you can navigate to your front-end application and enter "draft mode", where your queries are modified to fetch draft content instead of published content. This is useful for seeing how your content will look before being published. [More details](https://payloadcms.com/docs/admin/preview#draft-preview).
	- **Note:** Preview is different than [Live Preview](https://payloadcms.com/docs/live-preview/overview). Live Preview loads your app within an iframe and renders it in the Admin Panel allowing you to see changes in real-time. Preview, on the other hand, allows you to generate a direct link to your front-end application.
	- Im not sure about "live preview", may be a cool addition. But for now, with just a working preview, would be good. We need this to visualize "draft previews" above everything else.
		- "The Preview feature can be used to achieve "Draft Preview". After clicking the preview button from the Admin Panel, you can enter into "draft mode" within your front-end application. This will allow you to adjust your page queries to include the `draft: true` param. When this param is present on the request, Payload will send back a draft document as opposed to a published one based on the document's `_status` field. To enter draft mode, the URL provided to the `preview` function can point to a custom endpoint in your front-end application that sets a cookie or session variable to indicate that draft mode is enabled. This is framework specific, so the mechanisms here vary from framework to framework although the underlying concept is the same.
	- I think "Preview" is something that depends on some configuration from astro, and (maybe?) some cloudflare cache configurations as well. Im not sure. Do your research when it comes to it.

- We will preserve the exact same workflow when it comes to working with:
	- postgree
	- cloning production database locally, to play with it in a dev env if needed, and test migrations before they go live
	- the scripts we crafted for managing all them, be it in package.json and also trhe scripts folder
	- the cloudflare R2 custom pipeline. Our media assets, same as martyrio-cms, will also be hosted in R2. 
	- refernece any .env.example file, NEVER .env.
	- our `media-processor` and `svg-processor` from the plugins directory. The codebase is the soure of truth. Docs should help, but don't expect them to be as detailed or up to date. Still, have them as references. In fact, feel free to update them is we need to for some reason.
	- `instrumentation.ts`, as it includes proper pipelines to cleanup stuff from orphaned files and such from media-processor, and many other things.
	- `constants.ts`, and many other ts files
	- the Dockerfile and docker-compose.yml should be basically the same. Only changing the docker-compose file  to change the strings related to "martyrio" and anything for that matter to be "monk", like "monk-cms" and such.
	- We should use postgres:18 for this web instead of the 17 version martyrio-cms uses.
	- The CMS repo will be at github, to keep an eye in any existant github action, as they will build from the dockerfile we have.
	- This resulting docker image will then be pushed to our Coolify VPS at germany, and hosted there, with its own postgre18 instance that i will manually bootstrap there in the Coolify dashboard.
	- We need the same `access-control.ts` patterns when it comes to having admins that can access to the CMS, and some other users/admins that can enable an API key which we will use it for connecting our frontend to our backend, so only our frontend is able to retrieve data from the backend with REST calls or whatever we use, and such.
	- There are patterns like "deployQueues" or shopify, or graphql (used by shopify) stuff which we dont need at all. The pattern we should build here would be a proper cloudflare cache-tag purge originating from the CMS to invalidate the global CDN cache.
	- I dont know if `lib/storage.ts` makes any sense? We do need to support uploading 3D assets such as "glb" files to R2, later in the future. I don't know if this `storage.ts` follows patterns related to how `media-processor` references and uses Cloudflare R2, or if should be need to update. That also includes the aphromentioend `instrumentation.ts`, and everything
	- The backup mechanisms build in the dockerimage, and scripts, and how we connect to our VPS to clone the database that belongs to the project to work with the same copy from production but locally, to test migrations, etc. All those things are crucial as well.

All i've been saying so far, if you find ways to structure any piece of code better, when it comes to make it less repetitive (DRY, dont repeat yourself), or code deduplication, extracting helpers, whatever. You see what's the best procedure, of course.


#### Content schema

I'm a bit bad when discussing structures for the database/payload CMS, so I will do my best to describe them via text.

We have five sections in the page:
 - Overview
 - Work
 - Store
 - Archive

#### Section: Overview
- To be disclosed, we don't know its content for now
#### Section: Work
- The frontend page should be "/work"
- It will show a grid of images?
	- To be disclosed
- Each work is a case study, in some way
	- For instance, "/work/pslab" should render a layout to display the case study of PSLab
	- So, in the backend, we should be able to manage "works" by adding new ones, modify their content, etc
- Each work belongs to one (TO BE DISCLOSED if this is actually one or MULTIPLE categories) category. Categories, for now, are:
	- Brand Identity
	- UI/UX
	- Publications
	- Content Creation
- The way im imagining is that categories should be something we can modify, add, remove, change their visible text. For instance, if I create a cateogry "Brand Identity", i can then reference them in each "work" case study by its intefrnal id. In a way that if I decide to change the name later from "Brand Identity" to "Branding" for instance, the work case studies will update automatially by referenceing the id, or whatever databases uses for that matter.

- Each Work case study also includes the following (besides what I am comenting)
	- A featured/cover image
	- A gallery of media supporting images/videos/3D objects
		- The UI/UX in the backend when it comes to building this gallery should follow similarities the implementation of Media Gallery under "products" and "items" in `martyrio/cms`
		- There, in `martyrio/cms`, we have "Single Image" blocks, "Comparison Pair", and "Filterable Collection"
		- We don't have a super clear idea about what the specifics are when it comes to the options we want there, but we are sure that we need (for now) only the "Single Image" block, but turned into a "Single Media" block, with the exact same options featured in `martyrio/cms`, but adding support to attach a video or 3D object to it.
		- The ability to sort the blocks and overall logic of how this gallery component works in the backend should be preserved. We worked pretty hard to make it work in regards to the thumbnails being shown in the collapsible blocks there in the backend UI/UX, etc. Just ignore the existance of the comparison pair and filterable collection.
	- An info panel, implemented as a Payload "Blocks" field (allowing multiple blocks of any type to be added and reordered by the user), which includes:
		- InfoItem Block: A block that contains a title (string), content (Lite Lexical Editor), and a toggle for Display Mode (Fixed vs Collapsible). If collapsible, it includes a "Open by default" option.
		- Table Block: A block containing an array of rows. Each row consists of a Label (using a Smart-Tag Hybrid system: suggested strings based on a global registry to avoid typos and allow bulk renames) and a Value (Lite Lexical Editor to support basic formatting and links).
		
#### Section: Store
- Frontend page should be "/store"
- It will show a grid of images?
	- To be disclosed
- Each product in the store will feature the same customizability options as work. Same info panel, same gallery of media, same featured/cover image. We ditch the "category" from work as these products don't use them nor something similar.
- In the frontend, the layout of the products from Store and case studies from Work are pretty much the same.
#### Section: Archive
- To be disclosed, we don't know its content for now

#### Updating dependencies

There is a updating-dependencies.md doc in the `docs/` folder of the CMS, similarly to the frontend. But, in the case of Payload, we might keep it almost as-is, as there is not really extra tooling from it. The overall process for keeping up with new versions and changes in the case of Payload is more intricate than the frontend, but the docs should be pretty detailed. Feel free to take a look at it.



# Bootstraping this project
- You should read online docs using context 7 mcp about anything, more focused on payload, astro, to get to know their architecture, the latest updates (astro goes by 6.1 if im not mistaken), cloudflare, etc. 
- We need to have a monorepo, with a folder for the cms, another for docs, another for the frontend. This is a direct link to an article that describes how cloudflare works with monorepos: https://developers.cloudflare.com/workers/ci-cd/builds/advanced-setups/index.md. This is needed to know how to properly build a pipeline deployment. For the CMS, the github action should be configured to trigger on pushing stuff inside the CMS folder. In the case of the frontend, in our martyrio/web project, we would push stuff to `main` github repo, and cloudflare will pick it up automatically, pull it, and built it in their infra. I would like to think this would be a similar workflow, only as a monorepo. That article might be key in deciding how to proceed specifically with it. You tell me.
- As usual, if you have suggetions, questions about anything, this is the right moment to do it. We should carefully plan all this, and go through possible edge cases, confirm our suspicions with precise information, docs, cloning temporarly open source projects if we need answers directly from their source code, etc. 
- We also need to build a proper CLAUDE.md with key information. It should serve as a minimal document, with any importnat information that should be available ALWAYS in any new LLM conversation. But it shouldn't be ALL the info, that's what the code, properly documented, elegant, and the docs are for. CLAUDE.md should be able to point to pieces of our documentation if needed to have proper starting points references. Part of CLAUDE.md instructions should also include to properly document things, our commit workflow (similarly to how we do it in the frontend). Only using "non main" branches if we are working in large features that we need to commit (possibly to work across different computers) and might take days until we finish them, and they should not hit produciton. But this is for the long run. Here this page is in pretty early stages of development, so it's totally OK that we get to push everything to production, as nothing will be live in official domains at least.
- As I said and I will repeat, the docs from martyrio/web and martyrio/cms might be slightly outdated or incomplete at best, referencing to things that are being done in a different way. Actual source code is king, when it comes to assurance of how things work as reference.
