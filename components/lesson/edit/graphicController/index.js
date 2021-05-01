/** @jsxImportSource @emotion/react */
import React from 'react'
import { css } from '@emotion/core'
import useGraphicController from '../../../../libs/hooks/lesson/edit/useGraphicController'
import { useLessonEditorContext } from '../../../../libs/contexts/lessonEditorContext'
import LessonEditGraphicThumbnail from '../graphicThumbnail'

export default function LessonEditGraphicController() {
  const { graphics, graphicURLs, updateLine } = useLessonEditorContext()
  const { swapGraphic, removeGraphic } = useGraphicController({ graphics, updateLine })

  return (
    <div css={bodyStyle}>
      {Object.keys(graphicURLs).length > 0 &&
      <>
        <div css={headerStyle}>
          <div>アップロード済み ({Object.keys(graphicURLs).length})</div>
          <hr />
        </div>
        <div css={containerStyle}>
          {Object.keys(graphicURLs).map(key => (
            <div css={thumbnailStyle} key={key}>
              <LessonEditGraphicThumbnail url={graphicURLs[key]} />
            </div>
          ))}
        </div>
      </>
      }
    </div>
  )
}

const bodyStyle = css({
  height: 'calc(100% - 253px - 20px - 45px - 100px)', // 自身の上に存在する要素分を差し引く
  marginTop: '100px',
})

const headerStyle = css({
  height: '50px',
  fontSize: '14px',
  textAlign: 'center',
  color: 'gray',
})

const containerStyle = css({
  height: 'calc(100% - 50px)',
  overflowX: 'scroll',
  display: 'flex',
  alignContent: 'flex-start',
  flexWrap: 'wrap',
})

const thumbnailStyle = css({
  flex: 'calc(50% - 40px)',
  margin: '20px',
  textAlign: 'center',
})