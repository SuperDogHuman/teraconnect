/** @jsxImportSource @emotion/react */
import React, { useState } from 'react'
import { css } from '@emotion/core'

export default function FlipIconButton({ name, flipName, backgroundColor='inherit', color='inherit', borderColor='inherit', padding='0', onClick }) {
  const [isHover, setIsHover] = useState(false)

  function handleMouseEnter() {
    setIsHover(true)
  }

  function handleMouseLeave() {
    setIsHover(false)
  }

  const bodyStyle = css({
    display: 'block',
    width: '100%',
    height: '100%',
    padding: `${padding}px`,
    fontSize: 0,
    borderColor,
    backgroundColor,
    color,
    ':hover': {
      filter: 'brightness(80%)',
    },
  })

  return (
    <button onClick={onClick} css={bodyStyle} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <img src={`/img/icon/${isHover ? flipName : name}.svg`} draggable={false} css={imageStyle} />
    </button>
  )
}

const imageStyle = css({
  width: '100%',
  height: '100%',
})