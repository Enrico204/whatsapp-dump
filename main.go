package main

import (
	"io"
	"net/http"
	"os"
	"time"

	"github.com/gorilla/handlers"
)

type frontendMsg struct {
	Kind string `json:"kind"`
	Text string `json:"text"`
	Date string `json:"date"`
	Cite string `json:"cite"`
}

type WhatsappMessage struct {
	ID        string    `json:"id"`
	Kind      string    `json:"kind"`
	FromPhone string    `json:"from_phone"`
	FromName  string    `json:"from_name"`
	Text      string    `json:"text"`
	Time      time.Time `json:"time"`
	Forwarded bool      `json:"forwarded"`
}

var romeTZ *time.Location

func main() {
	var err error

	romeTZ, err = time.LoadLocation("Europe/Rome")
	if err != nil {
		panic(err)
	}

	r := http.NewServeMux()
	r.HandleFunc("/", incomingMsg)
	r.HandleFunc("/blob", incomingBlob)
	r.HandleFunc("/chatpicture", incomingChatPicture)

	http.ListenAndServe(":8080", handlers.CombinedLoggingHandler(os.Stdout, r))
}

func incomingBlob(w http.ResponseWriter, r *http.Request) {
	var fname = r.URL.Query().Get("id")
	if r.Header.Get("content-type") == "audio/mpeg" {
		fname += ".mp3"
	} else if r.Header.Get("content-type") == "image/jpeg" {
		fname += ".jpg"
	} else if r.Header.Get("content-type") == "audio/ogg; codecs=opus" {
		fname += ".ogg"
	}

	fp, err := os.Create("blobs/" + fname)
	if err != nil {
		panic(err)
	}
	_, err = io.Copy(fp, r.Body)
	if err != nil {
		panic(err)
	}
	_ = r.Body.Close()
	_ = fp.Close()

	w.WriteHeader(http.StatusCreated)
}

func incomingChatPicture(w http.ResponseWriter, r *http.Request) {
	var fname = r.URL.Query().Get("chatid")
	fp, err := os.Create("chatpic/" + fname + ".jpg")
	if err != nil {
		panic(err)
	}
	_, err = io.Copy(fp, r.Body)
	if err != nil {
		panic(err)
	}
	_ = r.Body.Close()
	_ = fp.Close()

	w.WriteHeader(http.StatusCreated)
}
