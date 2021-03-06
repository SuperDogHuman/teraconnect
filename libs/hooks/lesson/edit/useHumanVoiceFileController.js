import { useState, useEffect } from 'react'
import { useContextMenuContext } from '../../../contexts/contextMenuContext'
import { isBlobURL } from '../../../utils'
import { TEN_MB as maxFileByteSize } from '../../../constants'
import fetch from 'isomorphic-unfetch'
import { wavToMp3 } from '../../../audioUtils'

export default function useHumanVoiceFileController(config, dispatchConfig, inputFileRef) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [disableMenuIndexes, setDisableMenuIndexes] = useState([1]) // 初期状態では「ダウンロード」を選択できない
  const { setContextMenu } = useContextMenuContext()

  function handleMoreButtonClick(e) {
    const targetRect = e.currentTarget.getBoundingClientRect()
    setContextMenu({
      labels: ['アップロード', 'ダウンロード'],
      actions: [openFileSelector, downloadVoice],
      position: { fixed: true, x: targetRect.x + (targetRect.width / 2), y: targetRect.y + targetRect.height },
      disableMenuIndexes,
    })

    function openFileSelector() {
      inputFileRef.current.click()
    }

    async function downloadVoice() {
      if (isProcessing) return

      setIsProcessing(true)

      const link = document.createElement('a')
      link.download = 'voice'

      if (isBlobURL(config.url)) {
        const file = await(await fetch(config.url)).blob()
        if (file.type === 'audio/wav') { // 録音後、未確定のwav
          const url = URL.createObjectURL(await wavToMp3(file))
          link.href = url
        } else {                         // アップロード後、未確定のmp3
          link.href = config.url
        }
      } else {
        const file = await fetch(config.url) // 外部ドメインのファイルをクライアントでfetchすることで、ブラウザからのファイルDLを有効にする
        const url = URL.createObjectURL(await file.blob())
        link.href = url
      }
      link.click()

      setIsProcessing(false)
    }
  }

  function handleFileChange(e) {
    swapVoice(e.target.files[0])
    e.target.value = ''
  }

  function swapVoice(file) {
    if (isProcessing) return

    setIsProcessing(true)

    if (file.type !== 'audio/mpeg') return
    if (file.size > maxFileByteSize) return

    if (config.url && isBlobURL(config.url)) {
      URL.revokeObjectURL(config.url)
    }

    dispatchConfig({ type: 'humanVoice', payload: URL.createObjectURL(file) })
    setIsProcessing(false)
  }

  useEffect(() => {
    if (!config.url) return
    setDisableMenuIndexes([]) // 録音によりaudioURLが発行されたら、「ダウンロード」が選択可能になる
  }, [config])

  return { handleMoreButtonClick, handleFileChange }
}