import React from 'react'
import { Tab, TabList, Tabs, TabPanel, resetIdCounter } from 'react-tabs'
import TabListWithCloseButton from '../../../../tab/tabListWithCloseButton'
import TabContainer from '../../../../tab/tabContainer'
import DragHandler from '../../../../dragHandler'
import VoiceTab from './voiceTab'
import TextTab from './textTab'
import { useLessonEditorContext } from '../../../../../libs/contexts/lessonEditorContext'
import 'react-tabs/style/react-tabs.css'

export default function Speech({ config, closeCallback }) {
  const { updateLine } = useLessonEditorContext()

  function handleConfirm() {
    updateLine(config.lineIndex, config.kindIndex, 'speech', config.line)
    closeCallback()
  }

  function handleClose() {
    closeCallback()
  }

  resetIdCounter()

  return (
    <TabContainer minHeight='400'>
      <Tabs forceRenderTabPanel={true}>
        <DragHandler>
          <TabList>
            <TabListWithCloseButton onClose={handleClose} color='var(--soft-white)'>
              <Tab>字幕・テロップ</Tab>
              <Tab>音声</Tab>
            </TabListWithCloseButton>
          </TabList>
        </DragHandler>
        <TabPanel>
          <TextTab config={config.line} onCancel={handleClose} onConfirm={handleConfirm} />
        </TabPanel>
        <TabPanel>
          <VoiceTab config={config.line} onCancel={handleClose} onConfirm={handleConfirm} />
        </TabPanel>
      </Tabs>
    </TabContainer>
  )
}