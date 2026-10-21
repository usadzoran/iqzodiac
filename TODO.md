# IQZodiac — Delivery TODO

## Landing page in English
- [x] Display the site name “IQZodiac” in the center of the page as a clear, immediately identifiable text logo.
- [x] Provide a visible “Log In” button leading to the sign-in flow placeholder.
- [x] Provide a visible “Create Account” button leading to the account-creation flow placeholder.
- [x] Keep the layout polished and fully responsive on phone and desktop.

## User profile and privacy controls
- [x] Provide a Profile page with a profile photo, username, and phone number.
- [x] Let the user choose whether their phone number is shown to other people; keep it hidden by default.
- [x] Provide a Gallery for photos and videos.
- [x] Let the user choose whether their gallery is public or hidden; keep it private by default.

## Direct media upload and privacy preview
- [x] Let the user select multiple image and video files directly from the Gallery interface.
- [x] Show an immediate preview tile for each selected image or video with its media type and file size.
- [x] Update the Gallery item count after files are added and provide a clear upload confirmation.
- [x] Explain the current phone and gallery audience state inline: hidden/private by default, or visible/public when enabled.

## Social profile activity
- [x] Show Followers, Following, and Likes counters in the user profile.
- [x] Add interactive Follow back and Like profile actions with updated counters and labels.
- [x] Add a Notifications section with unread count, recent activity, and Mark all as read.
- [x] Persist social interaction states locally and keep the interface responsive on mobile and desktop.

## Home feed after login
- [x] Provide a Home page intended to appear after the user logs in.
- [x] Let users publish a text paragraph, photo, or video from the feed composer.
- [x] Let other users like, comment on, and share feed posts through interactive controls.
- [x] Show a responsive feed with suggested people and trending topics.

## AI assistant placeholder
- [x] Show a small robot icon and an “AI assistant — coming soon” placeholder above the login and account creation actions.
- [x] Keep the placeholder visual-only with no assistant connection or interaction yet.

## Account creation and identity check
- [x] Provide a Create Account page with first name, last name, age, email address, and phone number fields.
- [x] Require the user to be at least 18 years old.
- [x] Provide separate image capture/upload controls for a government ID photo and a face photo.
- [x] Show local previews and require confirmation that the photos belong to the user.
- [x] Keep the prototype local-only: no personal data or identity photos are uploaded yet.

## Discover and fixed user menu
- [x] Add a Discover page based on the supplied personality-elements quiz.
- [x] Keep the Discover quiz in Arabic with twelve questions, four element choices, animated result orbs, and a restart action.
- [x] Add a fixed bottom user menu on Home, Profile, and Discover.
- [x] Add Home, Discover, Profile, and a placeholder “New section” item to the menu for later development.

## Shared menu language
- [x] Keep the menu language consistent across Home, Profile, and Discover instead of changing with the page.
- [x] Automatically choose Arabic or English from the browser locale on first visit.
- [x] Provide a manual EN / العربية toggle and persist the selected language between pages.

## Audio rooms
- [x] Add a “Audio rooms / غرف صوتية” section to the fixed user menu.
- [x] Provide the supplied NEBULA room interface with host, speakers, listeners, talk requests, room chat, and room controls.
- [x] Keep room controls as a front-end prototype only: hand raising, microphone/sound state, chat messages, and leave-room state are local and not connected to real audio or a server.
- [x] Show rooms as closed directory cards by default with each room name and visitor count visible.
- [x] Add a second experimental room card, “نبض المدينة”, with its own visitor count.
- [x] Open the selected room only after the user presses its join button, and return to the card directory when leaving.
