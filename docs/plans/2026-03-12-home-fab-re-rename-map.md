# home-fab-re rename map

Target frame: `5371:21164`

This pass renames only meaningful container and action layers inside `home-fab-re`.
It intentionally avoids deep card internals and any component property changes.

## Top level

- `5371:21164` `홈-FAB-re` -> `home-fab-re`
- `5371:33624` `커서` -> `coachmark/tap-pointer`
- `5371:33631` `comp/tab/nav-main` -> `tab-bar/container`
- `5371:21167` `header_container` -> `header/container`
- `5371:21171` `container` -> `content/container`

## Tab bar

- `5371:33632` `container` -> `tab-bar/body`
- `5372:228289` `comp/tab/menu/main` -> `tab-bar/menu`
- `5372:228290` `button` -> `tab-item/home`
- `5372:228293` `button` -> `tab-item/explore`
- `5372:228296` `button` -> `tab-item/search`
- `5372:228299` `button` -> `tab-item/all`
- `5372:228315` `comp/fab` -> `fab/container`
- `5372:228334` `comp/fab/button` -> `fab/menu`
- `5372:228321` `comp/tab/menu/main` -> `fab/trigger`
- `5372:228322` `button` -> `fab/trigger-button`
- `5371:33635` `Home Indicator` -> `home-indicator`

## Header

- `5371:21169` `header` -> `header/bar`
- `5371:33678` `comp/heading` -> `header/heading`
- `5371:33679` `heading` -> `header/title-wrap`
- `5371:33680` `title` -> `header/title`
- `5371:33681` `action` -> `header/actions`
- `5371:33684` `button` -> `header/action-bookmark`
- `5371:33702` `button` -> `header/action-notification`
- `5371:33704` `badge` -> `header/notification-badge`

## Main content

- `5371:21172` `stack` -> `content/stack`
- `5371:33718` `comp/gen-chat` -> `ai-query/input`
- `5371:33719` `input` -> `ai-query/field`
- `5372:229086` `ic/gen-chat` -> `ai-query/icon`
- `5371:33721` `placeholder` -> `ai-query/placeholder`
- `5371:21174` `stack` -> `home-feed/stack`

## Hero banner

- `5371:33735` `comp/home-slide-banner` -> `hero-banner`
- `5371:33805` `comp/banner` -> `hero-banner/card`
- `5371:33806` `contents` -> `hero-banner/content`
- `5371:33807` `copy` -> `hero-banner/copy`
- `5371:33808` `title` -> `hero-banner/title`
- `5371:33809` `description` -> `hero-banner/description`
- `5371:33810` `image` -> `hero-banner/image`
- `5371:33859` `comp/slide-indicator` -> `hero-banner/pagination`

## Recommendation section

- `5371:21176` `section` -> `recommendation-section`
- `5371:21177` `title` -> `recommendation-section/title`
- `5371:21178` `list` -> `recommendation-card-list`
- `5371:33894` `card` -> `recommendation-card/primary`
- `5371:33903` `card` -> `recommendation-card/secondary`
- `5371:33911` `card` -> `recommendation-card/overflow`

## Recent section

- `5371:21182` `section-col` -> `recent-section`
- `5371:21183` `title` -> `recent-section/title`
- `5371:21184` `col-list` -> `recent-masonry-list`
- `5371:21185` `col` -> `recent-column/left`
- `5371:21189` `col` -> `recent-column/right`
