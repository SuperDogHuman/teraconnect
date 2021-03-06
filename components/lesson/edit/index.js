/** @jsxImportSource @emotion/react */
import React, { useState, useEffect } from 'react'
import { css } from '@emotion/core'
import { useScreenClass } from 'react-grid-system'
import useLessonCacheController from '../../../libs/hooks/lesson/edit/useLessonCacheController'
import useLessonUpdater from '../../../libs/hooks/lesson/edit/useLessonUpdater'
import { useContextMenuContext } from '../../../libs/contexts/contextMenuContext'
import { useLessonEditorContext } from '../../../libs/contexts/lessonEditorContext'
import { ImageViewerProvider } from '../../../libs/contexts/imageViewerContext'
import useResourceReloader from '../../../libs/hooks/lesson/edit/useResourceReloader'
import Loading from './loading'
import ContextMenu from '../../contextMenu'
import ImageViwer from '../../imageViewer'
import Header from '../../authoringHeader'
import Preview from './preview'
import DurationTime from './durationTime'
import GraphicController from './graphicController/'
import Timeline from './timeline'

export default function LessonEdit({ lesson }) {
  const screenClass = useScreenClass()
  const [isLoading, setIsLoading] = useState(true)
  const { isExistsCache, isExistsDiff, clearDiffFlag, getCache, clearCache } = useLessonCacheController({ isLoading, lessonID: lesson.id })
  const { contextMenu, handleDismiss } = useContextMenuContext()
  const { fetchResources, timeline } = useLessonEditorContext()
  const { hasResourceDiff, isUpdating, updateLesson, discardLessonDraft } = useLessonUpdater({ isLoading, isExistsDiff, clearDiffFlag, clearCache })
  useResourceReloader()

  const bodyStyle = css({
    margin: 'auto',
    maxWidth: '1280px',
    height: '100%',
    display: 'flex',
    flexDirection: ['xs', 'sm'].includes(screenClass) ? 'column' : 'row',
  })

  const leftSideStyle = css({
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 4,
    maxWidth: ['xs', 'sm'].includes(screenClass) ? '100%' : '450px',
    height: 'calc(100% - 80px)',
    marginTop: '40px',
    marginLeft: '10px',
    marginBottom: '40px',
  })

  const rightSideStyle = css({
    flexGrow: 6,
    maxWidth: ['xs', 'sm'].includes(screenClass) ? '100%' : '830px',
    height: 'calc(100% - 80px)',
    marginTop: '40px',
    marginLeft: '50px',
    marginRight: '10px',
    marginBottom: '40px',
  })

  useEffect(() => {
    fetchResources({ isExistsCache, getCache, lesson })
  }, [])

  useEffect(() => {
    if (Object.keys(timeline).length > 0) {
      setIsLoading(false)
    }
  }, [timeline])

  return (
    <>
      <ContextMenu {...contextMenu} handleDismiss={handleDismiss} />
      <Loading isShow={isLoading} />
      <Header currentPage='edit' showBadge={hasResourceDiff} isUpdating={isUpdating} updateLesson={updateLesson} discardLessonDraft={discardLessonDraft} />
      <main css={mainStyle}>
        <ImageViewerProvider>
          <div css={bodyStyle}>
            <div css={leftSideStyle}>
              <Preview />
              <DurationTime />
              <GraphicController />
            </div>
            <div css={rightSideStyle}>
              <Timeline />
            </div>
          </div>
          <ImageViwer />
        </ImageViewerProvider>
      </main>
    </>
  )
}

const mainStyle = css({
  width: '100%',
  height: 'calc(100vh - 60px)', // ヘッダの分を差し引いた画面の高さいっぱいに要素を表示
  backgroundColor: 'var(--bg-light-gray)',
  userSelect: 'none',
})

