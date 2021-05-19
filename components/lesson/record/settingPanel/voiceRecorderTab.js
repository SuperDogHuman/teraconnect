import React, { useEffect } from 'react'
import Flex from '../../../flex'
import Container from '../../../container'
import ContainerSpacer from '../../../containerSpacer'
import Spacer from '../../../spacer'
import Select from '../../../form/select'
import InputRange from '../../../form/inputRange'
import PlainText from '../../../plainText'
import LabelButton from '../../../button/labelButton'
import useAudioInputDevices from '../../../../libs/hooks/useAudioInputDevices'
import AlignContainer from '../../../alignContainer'

export default function VoiceRecorderTab({ setMicDeviceID, setSilenceThresholdSec, isShowVoiceSpectrum, silenceThresholdSec, setIsShowVoiceSpectrum }) {
  const { deviceOptions, requestMicPermission } = useAudioInputDevices()

  function handleThresholdChange(e) {
    setSilenceThresholdSec(parseFloat(e.target.value))
  }

  function hanldeMicChange(e) {
    setMicDeviceID(e.target.value)
  }

  function handleSpectrumShowChange() {
    setIsShowVoiceSpectrum(v => !v)
  }

  useEffect(() => {
    if (deviceOptions.length === 0) return

    setMicDeviceID(deviceOptions[0].value)
  }, [deviceOptions])

  return (
    <ContainerSpacer top='30' left='50' right='50'>
      <Select options={deviceOptions} onChange={hanldeMicChange} topLabel={null} color='var(--soft-white)' />

      <Spacer height='30' />

      <Flex>
        <Container width='120' height='30'>
          <PlainText size='13' color='var(--border-gray)' lineHeight='30'>無音検出閾値</PlainText>
        </Container>
        <Container width='150' height='30'>
          <Flex alignItems='center'>
            <Spacer height='30' />
            <InputRange min="0.1" max="2.0" step="0.1" value={silenceThresholdSec} onChange={handleThresholdChange} />
          </Flex>
        </Container>
        <Spacer width='20' />
        <Container width='50'>
          <PlainText size='13' color='var(--border-gray)' lineHeight='30'>{silenceThresholdSec} 秒</PlainText>
        </Container>
      </Flex>

      <Spacer height='10' />

      <Flex>
        <Container width='120' height='30'>
          <PlainText size='13' color='var(--border-gray)' lineHeight='30'>スペアナ表示</PlainText>
        </Container>
        <Container width='25' height='30'>
          <Flex alignItems='center'>
            <Spacer height='30' />
            <input type="checkbox" id='spectrumCheckbox' checked={isShowVoiceSpectrum} onChange={handleSpectrumShowChange} />
          </Flex>
        </Container>
        <Container height='30'>
          <label htmlFor='spectrumCheckbox'>
            <PlainText size='13' color='var(--border-gray)' lineHeight='30'>表示する</PlainText>
          </label>
        </Container>
      </Flex>

      <Spacer height='30' />

      <Flex justifyContent='center'>
        <Container width='300' height='40'>
          <LabelButton color='var(--soft-white)' borderColor='var(--border-gray)' onClick={requestMicPermission}>マイクの使用を許可する</LabelButton>
        </Container>
      </Flex>
      <AlignContainer textAlign='center'>
        <PlainText size='11' color='var(--border-gray)'>マイクの音声が取得できない場合に実行してください</PlainText>
      </AlignContainer>
    </ContainerSpacer>
  )
}