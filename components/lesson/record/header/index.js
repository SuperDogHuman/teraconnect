/** @jsxImportSource @emotion/react */
import React from 'react'
import Link from 'next/link'
import { css } from '@emotion/core'
import styled from '@emotion/styled'
import RecordIcon from './recordIcon'
import DrawingConfigPanel from './drawingConfigPanel'

export default function LessonRecordHeader(props) {
  function handleRecording() {
    props.startRecording(!props.recording)
  }

  function handleDrawingUndo() {
    props.setDrawingConfig({ undo: true })
  }

  function handleDrawingClear() {
    props.setDrawingConfig({ clear: true })
    props.setRecord({ drawingClear: true })
  }

  function handleDrawingHide() {
    props.setDrawingConfig({ hide: !props.drawingConfig.hide })
    props.setRecord({ drawingHide: !props.drawingConfig.hide })
  }

  function handleSettingPanel() {
    props.setShowControlPanel(state => !state)
  }

  return (
    <header css={headerStyle} className='header-z'>
      <div css={bodyStyle}>
        <div css={flexItemStyle}>
          <Link href="/">
            <a>
              <img
                css={logoImageStyle}
                src="/img/logo.png"
                srcSet="/img/logo.png 1x, /img/logo@2x.png 2x"
              />
            </a>
          </Link>
        </div>
        <div css={flexItemStyle}>
          <button onClick={handleRecording} css={recordingButtonStyle}>
            <div css={recordingIconStyle}>
              <RecordIcon recording={props.recording} />
            </div>
            <div css={recordingStatusStyle}>
              <span>{props.recording ? '' : ''}</span>
            </div>
          </button>
        </div>
        <div css={flexItemStyle}>
          <DrawingButton onClick={handleDrawingHide}><img src="/img/icon/hide.svg" /></DrawingButton>
          <DrawingButton css={{ paddingRight: '0px' }}><img src="/img/icon/drawing.svg" /></DrawingButton>
          <DrawingConfigPanel drawingConfig={props.drawingConfig} setDrawingConfig={props.setDrawingConfig}/>
          <DrawingButton onClick={handleDrawingUndo}><img src="/img/icon/undo.svg" /></DrawingButton>
          <DrawingButton onClick={handleDrawingClear}><img src="/img/icon/trash.svg" /></DrawingButton>
          <DrawingButton css={{ marginLeft: '150px' }} onClick={handleSettingPanel}><img src="/img/icon/settings.svg" /></DrawingButton>
        </div>
      </div>
    </header>
  )
}

const headerStyle = css({
  width: '100%',
  backgroundColor: 'var(--dark-gray)',
  position: 'fixed',
  top: 0,
  left: 0,
})

const bodyStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  maxWidth: '1280px',
  height: '77px',
  marginLeft: 'auto',
  marginRight: 'auto',
})

const logoImageStyle = css({
  width: '181px',
  height: '25px',
  verticalAlign: 'middle',
})

const flexItemStyle = css({
  width: '100%',
  textAlign: 'center',
})

const recordingButtonStyle = css({
  position: 'relative',
  ['img']: {
    width: '26px',
    height: 'auto',
    verticalAlign: 'middle',
  },
  [':hover']: {
    backgroundColor: 'var(--text-gray)',
  }
})

const recordingStatusStyle = css({
  position: 'absolute',
  height: '77px',
  top: 0,
  left: 50,
})

const recordingIconStyle = css({
  width: '26px',
  height: '26px',
})

const DrawingButton = styled.button`
  > img {
    width: 20px;
    height: auto;
    vertical-align: middle;
  }
  :hover {
    background-color: var(--text-gray);
  }
`