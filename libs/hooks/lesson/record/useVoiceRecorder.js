import { useState, useEffect } from 'react'
import useMicrophone from '../../useMicrophone'

let recorder

export default function useVoiceRecorder(id, token, isRecording, setRecord) {
  const [isTalking, setIsTalking] = useState(false)
  const [micDeviceID, setMicDeviceID] = useState()
  const [silenceThresholdSec, setSilenceThresholdSec] = useState(0.6)
  const { audioCtx, isMicReady, setNode } = useMicrophone(micDeviceID)

  function switchMicRecording() {
    if (isMicReady) {
      recorder.port.postMessage({ isRecording })
    } else {
      setTimeout(() => {
        switchMicRecording()
      }, 1000)
    }
  }

  function uploadVoice(result) {
    /*
    const callback = (voice => {
      setRecord('voice', voice)
    }, talking => {
      setIsTalking(talking)
    )

    const voice = {
      timeSec: result.speechedAt,
      durationSec: result.durationSec
    }
    callback(voice)

    const uploader = new Worker('voiceUploader.js')
    uploader.postMessage({
        url: Const.RAW_VOICE_API_URL,
        lessonID: id,
        time: result.speechedAt,
        buffers: result.buffers,
        bufferLength: result.bufferLength,
        currentSampleRate: this._audioCtx.sampleRate
    })

    uploader.onmessage = (event => {
        voice.fileID = event.data.fileID
        callback(voice)
        uploader.terminate()
    })
    */
  }

  async function initAudioWorklet() {
    await audioCtx.audioWorklet.addModule('/voiceRecorderProcessor.js')
    recorder = new AudioWorkletNode(audioCtx, 'recorder')
    recorder.port.onmessage = e => {
      uploadVoice(e.data)
    }
  }

  useEffect(() => {
    if (!audioCtx) return
    initAudioWorklet()
  }, [audioCtx])

  useEffect(() => {
    if (!micDeviceID) return
    setNode(recorder)
  }, [micDeviceID])

  useEffect(() => {
    switchMicRecording()
  }, [isRecording])

  useEffect(() => {
    // set volume threshold
    // recorder.port.postMessage({ changeThreshold: silenceThresholdSec })
  }, [silenceThresholdSec])

  return { isTalking, setMicDeviceID, setSilenceThresholdSec }
}