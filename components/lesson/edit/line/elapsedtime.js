/** @jsxImportSource @emotion/react */
import React from 'react'
import { css } from '@emotion/core'
import { floatSecondsToMinutesFormat } from '../../../../libs/utils'

export default function ElapsedTime({ elapsedTime }) {
  return (
    <div css={bodyStyle}>
      {floatSecondsToMinutesFormat(elapsedTime)}
    </div>
  )
}

const bodyStyle = css({
  color: 'lightGray', // fixme
  fontSize: '15px',
  lineHeight: '55px',
  letterSpacing: '1px',
  paddingLeft: '10px',
})