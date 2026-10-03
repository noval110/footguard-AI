package handlers

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestSignalPayloadValidation(t *testing.T) {
	for _, tc := range []struct {
		kind, data string
		id         int64
		want       bool
	}{
		{"call_offer", `{"type":"offer","sdp":"v=0\nm=audio 9 UDP/TLS/RTP/SAVPF 111"}`, 1, true},
		{"call_answer", `{"type":"answer","sdp":"v=0\nm=audio 9 UDP/TLS/RTP/SAVPF 111"}`, 1, true},
		{"call_offer", `{"type":"offer","sdp":"v=0\nm=video 9 UDP/TLS/RTP/SAVPF 96"}`, 1, false},
		{"call_offer", `{"type":"answer","sdp":"audio"}`, 1, false},
		{"call_answer", `{"type":"answer","sdp":""}`, 1, false},
		{"ice_candidate", `{"candidate":"candidate:1","sdpMid":"0"}`, 1, true},
		{"ice_candidate", `{"candidate":null}`, 1, false},
		{"ice_candidate", `{"candidate":"candidate:1"}`, 0, false},
		{"unknown", `{}`, 1, false},
		{"call_offer", `not JSON`, 1, false},
	} {
		if got := validSignal(socketInput{Kind: tc.kind, CallID: tc.id, Data: json.RawMessage(tc.data)}); got != tc.want {
			t.Errorf("%s id=%d got %v want %v", tc.kind, tc.id, got, tc.want)
		}
	}
	large, _ := json.Marshal(map[string]string{"type": "offer", "sdp": strings.Repeat("a", 49<<10)})
	if validSignal(socketInput{Kind: "call_offer", CallID: 1, Data: large}) {
		t.Fatal("oversized SDP accepted")
	}
}
