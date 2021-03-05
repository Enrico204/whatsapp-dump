This is a proof-of-concept. **Not ready for production**. Also the code is a
mess.

The goal is to dump all conversations, media and audio from Whatsapp web, for
backup purposes.

This project is made by two parts: the "client" that interacts with Whatsapp
Web UI in javascript, and the "server" that saves the content as local file.
This architecture is needed as javascript can't save local files (thanks God).

# Requirements

* Go ("server" part)
* Greasemonkey (or compatible) in Firefox (might work in other browsers)

# Roadmap

## Client side (js)

Here "save" means that the content is sent to the "server" part.

* [X] Basic text message dump for the current chatroom
  * works, however the parsing section in Go is not working properly
* [X] Save audio
* [X] Save pictures
* [ ] Save other files
* [X] Save group name and picture
* [ ] Trigger audio/media download automatically
  * works for audio, however there is a nasty but in the media part that
    triggers an infinite loop of download popups
* [ ] Automatically cycle all chatrooms

## Server side (Go)

* [ ] Parse incoming text messages
  * It used to work, however the format is changed in the client and the
    server is not aligned yet
* [X] Save incoming audio blobs
* [X] Save incoming picture blobs
* [ ] Save a "decent" JSON dump of the chatroom messages, link each media

# License

See [LICENSE](LICENSE).