import { useLessonEditorContext } from '../../../contexts/lessonEditorContext'
import useAudioPlayer from '../../useAudioPlayer'
import useSynthesisVoice from './useSynthesisVoice'
import { findNextElement } from '../../../utils'
import { fetchWithAuth } from '../../../fetch'
import { useRouter } from 'next/router'

export default function useSpeechController({ speech, lineIndex, kindIndex }) {
  const router = useRouter()
  const { isLoading, setIsLoading, isPlaying, createAudio, switchAudio, audioRef } = useAudioPlayer()
  const { addSpeechLine, updateLine } = useLessonEditorContext()
  const { createSynthesisVoiceFile } = useSynthesisVoice()

  async function handleSpeechClick(text) {
    setIsLoading(true)
    await setAudioIfNeeded(text)
    setIsLoading(false)
    switchAudio()
  }

  function fetchVoiceFileURL(voiceID, lessonID) {
    return fetchWithAuth(`/voices/${voiceID}?lesson_id=${lessonID}`)
      .then(result => result)
      .catch(e  => {
        console.error(e)
      })
  }

  async function setAudioIfNeeded(text) {
    const lessonID = parseInt(router.query.id)

    if (speech.url) {
      if (!audioRef.current) createAudio(speech.url)
    } else if (speech.isSynthesis && speech.text) {
      speech.subtitle = text
      const voice = await createSynthesisVoiceFile(lessonID, speech)
      createAudio(voice.url)
      speech.voiceID = voice.id
      speech.url = voice.url

      updateLine(lineIndex, kindIndex, 'speech', speech)
    } else if (!speech.isSynthesis) {
      const voice = await fetchVoiceFileURL(speech.voiceID, lessonID)
      createAudio(voice.url)
      speech.url = voice.url

      updateLine(lineIndex, kindIndex, 'speech', speech)
    }
  }

  function handleInputKeyDown(e) {
    if (e.keyCode != 13) return // Enter以外のキーや、Enterでも日本語の確定でキーを押下した場合はスキップ

    let current = e.target.parentNode
    while(current.parentNode != null && current.parentNode != document.documentElement) {
      if (current.draggable) break
      current = current.parentNode
    }

    findNextElement(current, 'input', inputs => {
      inputs[0].focus()
    })

    if (document.activeElement === e.target) {
      addSpeechLine() // フォーカスが変わらなかったら最後の行なので、新しい行を追加する
    }
  }

  function handleTextBlur(e) {
    const text = e.target.value
    if (text === speech.subtitle) return

    speech.subtitle = text
    updateLine(lineIndex, kindIndex, 'speech', { ...speech })
  }

  return { isLoading, isPlaying, handleSpeechClick, handleInputKeyDown, handleTextBlur }
}