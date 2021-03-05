package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"
)

func incomingMsg(w http.ResponseWriter, r *http.Request) {
	chatID := r.URL.Query().Get("chatid")

	var dump struct {
		Title    string                 `json:"title"`
		Messages map[string]frontendMsg `json:"messages"`
	}
	err := json.NewDecoder(r.Body).Decode(&dump)
	if err != nil {
		panic(err)
	}
	_ = r.Body.Close()

	dumpJSONToFile(chatID+".raw.json", dump)

	var messages = make(map[string]WhatsappMessage)
	var lastMsg *WhatsappMessage

	for tag := range dump.Messages {
		var dumpmsg = dump.Messages[tag]
		var msg = WhatsappMessage{
			ID: tag,
		}

		if dumpmsg.Kind == "text" {
			msgspart := strings.Split(dumpmsg.Text, "\n")
			if len(msgspart) == 1 {
				// No data?
			} else if len(msgspart) < 3 && lastMsg == nil {
				// Same from previous author, but no author!
				fmt.Println(dumpmsg.Text)
				fmt.Println(tag)
				fmt.Println("")
				continue
			} else if len(msgspart) == 2 {
				msg.FromPhone = lastMsg.FromPhone
				msg.FromName = lastMsg.FromName
				if msgspart[0] == "Forwarded" {
					msg.Forwarded = true
					msg.Text = strings.Join(msgspart[1:len(msgspart)-1], "\n")
				} else {
					msg.Text = strings.Join(msgspart[:len(msgspart)-1], "\n")
				}
			} else if len(msgspart) > 2 {
				msg.FromPhone = msgspart[0]
				msg.FromName = msgspart[1]
				if msgspart[2] == "Forwarded" {
					msg.Forwarded = true
					msg.Text = strings.Join(msgspart[3:len(msgspart)-1], "\n")
				} else {
					msg.Text = strings.Join(msgspart[2:len(msgspart)-1], "\n")
				}
			} else {
				fmt.Println(dumpmsg.Text)
				fmt.Println(tag)
				fmt.Println("")
				continue
			}

			msgTimeParts := strings.Split(dumpmsg.Date, "]")

			var err error
			msg.Time, err = time.ParseInLocation("15:04, 1/2/2006", msgTimeParts[0][1:], romeTZ)
			if err != nil {
				panic(err)
			}
		} else if dumpmsg.Kind == "audio" {
			// TODO: timestamp
		} else {
			fmt.Printf("%#v\n", dumpmsg)
			continue
		}

		msg.Kind = dumpmsg.Kind
		messages[tag] = msg
		lastMsg = &msg
	}

	dumpJSONToFile(chatID+".json", struct {
		Title    string
		Messages map[string]WhatsappMessage
	}{
		Title:    dump.Title,
		Messages: messages,
	})
}

func dumpJSONToFile(fname string, obj interface{}) {
	fp, err := os.Create(fname)
	if err != nil {
		panic(err)
	}
	jenc := json.NewEncoder(fp)
	jenc.SetIndent("", "    ")
	err = jenc.Encode(obj)
	if err != nil {
		panic(err)
	}
	_ = fp.Close()
}
