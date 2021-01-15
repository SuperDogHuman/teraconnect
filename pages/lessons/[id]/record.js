/** @jsxImportSource @emotion/react */
import React, { useState, useEffect, useRef } from 'react'
import Head from 'next/head'
import useRecordResource from '../../../libs/hooks/lesson/record/useRecordResource'
import useRecorder from '../../../libs/hooks/lesson/record/useRecorder'
import useLessonImage from '../../../libs/hooks/lesson/useImage'
import useLessonAvatar from '../../../libs/hooks/lesson/useAvatar'
import useVoiceRecorder from '../../../libs/hooks/lesson/record/useVoiceRecorder'
import useLessonDrawing from '../../../libs/hooks/lesson/useDrawing'
import LessonRecordHeader from '../../../components/lesson/record/header/'
import LoadingIndicator from '../../../components/loadingIndicator'
import LessonBackgroundImage from '../../../components/lesson/backgroundImage'
import LessonAvatar from '../../../components/lesson/avatar'
import LessonImage from '../../../components/lesson/image'
import LessonDrawing from '../../../components/lesson/drawing'
import LessonRecordSettingPanel from '../../../components/lesson/record/settingPanel/'
import LessonRecordImageController from '../../../components/lesson/record/imageController'
import LessonRecordRandomTips from '../../../components/lesson/record/randomTips'
import Footer from '../../../components/footer'
import requirePageAuth from '../../../components/requirePageAuth'
import { fetchWithAuth } from '../../../libs/fetch'
import { css } from '@emotion/core'

const Page = ({ token, lesson }) => {
  const containerRef = useRef(null)
  const [hasResize, setHasResize] = useState()
  const [isLoading, setIsLoading] = useState(true)
  const [isRecording, setIsRecording] = useState(false)
  const [bgImageURL, setBgImageURL] = useState()
  const [isShowControlPanel, setIsShowControlPanel] = useState(false)
  const [isDrawingHide, setIsDrawingHide] = useState(false)
  const { setRecord } = useRecorder(lesson.id, token, isRecording)
  const { bgImages, avatars, bgms } = useRecordResource(token, setBgImageURL)
  const { lessonImage, setLessonImage, uploadLessonImage } = useLessonImage(lesson.id, token)
  const { isTalking, setVoiceRecorderConfig } = useVoiceRecorder(lesson.id, token, isRecording, setRecord)
  const { setAvatarConfig, avatarRef, startDragging, inDragging, endDragging } = useLessonAvatar(setIsLoading, isTalking, hasResize, setRecord)
  const { enablePen, setEnablePen, undoDrawing, clearDrawing, drawingColor, setDrawingColor, setDrawingLineWidth,
    startDrawing, inDrawing, endDrawing, drawingRef } = useLessonDrawing(setRecord, hasResize, startDragging, inDragging, endDragging)

  useEffect(() => {
    const resizeObserver = new ResizeObserver(e => {
      setHasResize({ width: e[0].contentRect.width, height: e[0].contentRect.height })
    })
    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  const loadingStyle = css({
    display: isLoading ? 'block' : 'none',
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    height: '100%',
  })

  return (
    <>
      <Head>
        <title>{lesson.title}の収録 - TERACONNECT</title>
      </Head>
      <LessonRecordHeader isRecording={isRecording} setIsRecording={setIsRecording} setRecord={setRecord}
        isDrawingHide={isDrawingHide} setIsDrawingHide={setIsDrawingHide} enablePen={enablePen} setEnablePen={setEnablePen}
        undoDrawing={undoDrawing} clearDrawing={clearDrawing} drawingColor={drawingColor} setDrawingColor={setDrawingColor}
        setDrawingLineWidth={setDrawingLineWidth} setIsShowControlPanel={setIsShowControlPanel} />
      <main css={mainStyle}>
        <div css={bodyStyle} ref={containerRef}>
          <div css={loadingStyle} className="indicator-z">
            <LoadingIndicator />
          </div>
          <LessonBackgroundImage src={bgImageURL} />
          <LessonImage src={lessonImage} />
          <LessonAvatar ref={avatarRef} onMouseDown={startDragging} onMouseMove={inDragging} onMouseUp={endDragging} onMouseLeave={endDragging} />
          <LessonDrawing isHide={isDrawingHide} startDrawing={startDrawing} inDrawing={inDrawing} endDrawing={endDrawing} drawingRef={drawingRef}  />
          <LessonRecordSettingPanel isShow={isShowControlPanel} setIsShow={setIsShowControlPanel} bgImages={bgImages} setBgImageURL={setBgImageURL}
            avatars={avatars} setAvatarConfig={setAvatarConfig} bgms={bgms} setVoiceRecorderConfig={setVoiceRecorderConfig}
            setRecord={setRecord} />
        </div>
        <LessonRecordImageController setLessonImage={setLessonImage} uploadImage={uploadLessonImage} setRecord={setRecord} />
        <LessonRecordRandomTips />
      </main>
      <Footer />
    </>
  )
}

export default Page

export async function getServerSideProps(context) {
  const authProps = await requirePageAuth(context)
  const id = context.query.id

  const lesson = await fetchWithAuth(`/lessons/${id}?for_authoring=true`, authProps.props.token)
    .then(r => r)
    .catch(e => {
      if (e.responseCode === '401') {
        context.res.writeHead(307, { Location: '/login' })
        context.res.end()
      } else {
        throw e
      }
    })

  return { props: {
    ...authProps.props,
    lesson,
  } }
}

const mainStyle = css({
  position: 'relative',
  width: '100%',
  height: '100%',
  backgroundColor: 'var(--back-movie-black)',
  userSelect: 'none',
})

const bodyStyle = css({
  position: 'relative',
  marginLeft: 'auto',
  marginRight: 'auto',
  maxWidth: '1280px',
  maxHeight: '720px',
})