import React from 'react';
import Menu from '../menu';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { setupPoseDetector, detectPoseInRealTime, clearPoseCanvas } from './poseDetector';
//import VoiceRecorder from './voiceRecorder';
import LessonRecorder from './lessonRecorder';
import AvatarPreview from './avatarPreview';
import LessonGraphic from './lessonGraphic';
import * as Const from '../common/constants';

export default class LessonRecorderScreen extends React.Component {
    constructor(props) {
        super(props)

        this.state = {
            detectedPose: {},
            graphicURL: '',
            faceName: 'Default',
            moveDirection: 'stop',
            isLoading: true,
            isRecording: false,
            isPause: false,
            isPoseDetecting: false,
        };

        // TODO loading resources.
        this.avatarURL = "http://localhost:1234/bdiuotgrbj8g00l9t3ng.vrm";
        this.graphicURLs = [
            {
                id: 1,
                url: 'https://s3-ap-northeast-1.amazonaws.com/ftext/mathII/p143.png',
            },
            {
                id: 2,
                url: 'https://s3-ap-northeast-1.amazonaws.com/ftext/mathII/p144-1.png',
            },
            {
                id: 3,
                url: 'https://s3-ap-northeast-1.amazonaws.com/ftext/mathI/numberline.png',
            },
        ];
        this.graphicURLIndex = -1;
        this.avatarPreview;
        this.recorder = new LessonRecorder();
//        this.voiceRecorder = new VoiceRecorder();
        this.isLoading = true;
    }

    async componentDidMount() {
        setupPoseDetector(() => {
            this.setState({ isLoading: false });
        });
    }

    componentDidUpdate(_, prevState) {
        if (!prevState.isPoseDetecting && this.state.isPoseDetecting) {
            this._poseDetectionFrame();
        }

        if (prevState.isRecording != this.state.isRecording) {
            this.recorder.start(this.state.isRecording);
        }
    }

    _recordingStart() {
        this.setState({ isRecording: true });
    }

    _recordingStop() {
        this.setState({ isRecording: false, isPause: true });
    }

    _recordingResume() {
        this.setState({ isRecording: true, isPause: false });
    }

    _switchPoseDetection() {
        this.setState({ isPoseDetecting: !this.state.isPoseDetecting });
    }

    _switchFace(faceName) {
        if (this.state.faceName == faceName) return;

        this.setState({ faceName: faceName });
        this.recorder.addSwitchingFace(faceName);
    }

    _switchGraphic(diff) {
        this.graphicURLIndex += diff;
        const graphic = (this.graphicURLIndex > -1) ?
            this.graphicURLs[this.graphicURLIndex] : { id: null, url: ''};
        this.setState({ graphicURL: graphic.url });
        this.recorder.addSwitchingGraphic(graphic.id);
    }

    _movePosition(direction) {
        this.setState({ moveDirection: direction });
    }

    _stopMovingPosition() {
        if (this.state.moveDirection == 'stop') return;
        this.setState({ moveDirection: 'stop' });
    }

    recordMovedPosition(position) {
        this.recorder.addAvatarPosition(position);
    }

    _postRecord() {
        this.recorder.sendRecord();
    }

    async _poseDetectionFrame() {
        if (!this.state.isPoseDetecting) {
            this.setState({ detectedPose: {} });
            clearPoseCanvas();
            return;
        }

        const pose = await detectPoseInRealTime();
        const avatarPose = this.recorder.addAvatarPose(pose);
        this.setState({ detectedPose: avatarPose });

        requestAnimationFrame(() => this._poseDetectionFrame());
    }

    render() {
        return(
            <div id="lesson-recorder-screen">
                <Menu selectedIndex='2' />

                <div id="lesson-recorder" ref={(e) => { this.avatarPreview = e; }}>

                    <AvatarPreview
                        avatarURL={this.avatarURL}
                        pose={this.state.detectedPose}
                        faceName={this.state.faceName}
                        moveDirection={this.state.moveDirection}
                        movedPosition={(position) => { this.recordMovedPosition(position); }}
                        previewContainer={this.avatarPreview}
                        isPoseDetecting={this.state.isPoseDetecting}
                    />

                    <LessonGraphic url={this.state.graphicURL} />

                    <video id="pose-video" playsInline></video>
                    <div id="pose-keypoint">
                        <canvas id="pose-keypoint-canvas"></canvas>
                    </div>

                    <div id="control-panel">

                        <div id="indicator">
                            <div id="recording-status">
                                <FontAwesomeIcon icon={['fas', 'video']} />
                                REC
                            </div>

                            <div id="record-elapsed-time">
                                {//this.recorder.currentRecordingTime()
                                }
                            </div>
                        </div>

                        <div>
                            <button type="button" className="btn" onClick={this._switchPoseDetection.bind(this)}>
                                <FontAwesomeIcon icon={['fas', 'walking']} />
                                ポーズ検出
                            </button>
                        </div>

                        <div id="emotion-controller">
                            <button type="button" className="btn btn-dark" onClick={this._switchFace.bind(this, 'Default')}>
                                <FontAwesomeIcon icon={['far', 'meh-blank']} />
                            </button>
                            <button type="button" className="btn btn-dark" onClick={this._switchFace.bind(this, 'AllFun')}>
                                <FontAwesomeIcon icon={['fas', 'smile']} />
                            </button>
                            <button type="button" className="btn btn-dark" onClick={this._switchFace.bind(this, 'AllJoy')}>
                                <FontAwesomeIcon icon={['fas', 'laugh-beam']} />
                            </button>
                            <button type="button" className="btn btn-dark" onClick={this._switchFace.bind(this, 'AllSorrow')}>
                                <FontAwesomeIcon icon={['fas', 'frown-open']} />
                            </button>
                            <button type="button" className="btn btn-dark" onClick={this._switchFace.bind(this, 'AllAngry')}>
                                <FontAwesomeIcon icon={['fas', 'angry']} />
                            </button>
                            <button type="button" className="btn btn-dark" onClick={this._switchFace.bind(this, 'AllSurprised')}>
                                <FontAwesomeIcon icon={['fas', 'surprise']} />
                            </button>
                        </div>

                        <div>
                            <button type="button" id="prev-graphic-btn" className="btn graphic-btn"
                                disabled={this.graphicURLIndex == -1}
                                onClick={this._switchGraphic.bind(this, -1)}>
                                <FontAwesomeIcon icon={['fas', 'image']} />
                            </button>
                            <button type="button" id="next-graphic-btn" className="btn graphic-btn"
                                disabled={this.graphicURLIndex == this.graphicURLs.length - 1}
                                onClick={this._switchGraphic.bind(this, 1)}>
                                <FontAwesomeIcon icon={['fas', 'image']} />
                            </button>
                        </div>

                        <div id="rec-single-btns">
                            <button type="button" id="btn-start-record" className="btn btn-danger btn-rec"
                                onClick={this._recordingStart.bind(this)}>
                                <FontAwesomeIcon icon={['far', 'dot-circle']} />収録開始
                            </button>
                            <button type="button" id="btn-stop-record" className="btn btn-secondary btn-with-hover btn-rec"
                                onClick={this._recordingStop.bind(this)}>
                                <FontAwesomeIcon icon={['far', 'pause-circle']} />停止
                            </button>
                        </div>
                        <div id="rec-pair-btns" className="btn-in-stop">
                            <button type="button" className="btn btn-primary btn-with-hover btn-rec"
                                onClick={this._postRecord.bind(this)}>
                                <FontAwesomeIcon icon={['fas', 'cloud-upload-alt']} />保存
                            </button>
                            <button type="button" className="btn btn-primary btn-with-hover btn-rec"
                                onClick={this._recordingResume.bind(this)}>
                                <FontAwesomeIcon icon={['far', 'dot-circle']} />再開
                            </button>
                        </div>

                        <div id="position-controller" onMouseOut={this._stopMovingPosition.bind(this)}>
                            <button type="button" className="btn btn-dark"
                                onMouseDown={this._movePosition.bind(this, 'front')}
                                onMouseUp={this._stopMovingPosition.bind(this)}>
                                <FontAwesomeIcon icon={['fas', 'arrow-up']} />
                            </button>
                            <button type="button" className="btn btn-dark"
                                onMouseDown={this._movePosition.bind(this, 'back')}
                                onMouseUp={this._stopMovingPosition.bind(this)}>
                                <FontAwesomeIcon icon={['fas', 'arrow-down']} />
                            </button>
                            <button type="button" className="btn btn-dark"
                                onMouseDown={this._movePosition.bind(this, 'left')}
                                onMouseUp={this._stopMovingPosition.bind(this)}>
                                <FontAwesomeIcon icon={['fas', 'arrow-left']} />
                            </button>
                            <button type="button" className="btn btn-dark"
                                onMouseDown={this._movePosition.bind(this, 'right')}
                                onMouseUp={this._stopMovingPosition.bind(this)}>
                                <FontAwesomeIcon icon={['fas', 'arrow-right']} />
                            </button>
                        </div>
                    </div>

                </div>

                <style jsx>{`
                    #lesson-recorder-screen {
                        width: 100%;
                        height: 100%;
                    }
                    #lesson-recorder {
                        position: relative;
                        width: 100%;
                        height: ${Const.RATIO_16_TO_9 * 100}vw;
                        max-height: calc(100% - 50px); /* for menu */
                    }
                    #pose-video {
                        position: absolute;
                        top: 0;
                        left: 0;
                        transform: scaleX(-1);
                    }
                    #pose-keypoint {
                        display: ${this.state.isPoseDetecting ? 'block' : 'none'};
                        position: absolute;
                        top: 0;
                        left: 0;
                    }
                    #control-panel {
                        display: ${this.state.isLoading ? 'none' : 'block'};
                        position: absolute;
                        z-index: 100;
                        width: 100%;
                        height: 100%;
                        top: 0;
                        bottom: 0;
                        left: 0;
                        right: 0;
                    }
                    #indicator {
                        position: absolute;
                        top: 2vh;
                        right: 2vw;
                    }
                    #recording-status {
                        display: ${this.state.isRecording ? 'block' : 'none'};
                    }
                    .graphic-btn {
                        position: absolute;
                        width: 5vw;
                        height: 5vw;
                        top: 0;
                        bottom: 0;
                        margin-top: auto;
                        margin-bottom: auto;
                        font-size: 3vw;
                    }
                    #prev-graphic-btn {
                        left: 2vw;
                    }
                    #next-graphic-btn {
                        right: 2vw;
                    }
                    .btn-rec {
                        width: 17vw;
                        height: 7vw;
                        font-size: 3vw;
                    }
                    #rec-single-btns button {
                        position: absolute;
                        left: 0;
                        right: 0;
                        bottom: 5vh;
                        margin-left: auto;
                        margin-right: auto;
                    }
                    #rec-pair-btns {
                        position: absolute;
                        left: 0;
                        right: 0;
                        bottom: 5vh;
                        margin-left: auto;
                        margin-right: auto;
                        text-align: center;
                    }
                    #rec-pair-btns button {
                        margin-left: 1vw;
                        margin-right: 1vw;
                    }
                    #btn-start-record {
                        display: ${!this.state.isRecording && !this.state.isPause ? 'inline-block' : 'none'};
                    }
                    #btn-stop-record {
                        display: ${this.state.isRecording ? 'inline-block' : 'none'};
                    }
                    .btn-in-stop {
                        display: ${this.state.isPause ? 'inline-block' : 'none'};
                    }
                    .btn-with-hover {
                        opacity: 0.2;
                    }
                    .btn-with-hover :hover {
                        opacity: 1;
                    }
                    #emotion-controller {
                        position: absolute;
                    }
                    #emotion-controller button {
                        width: 4vh;
                        height: 4vh;
                        font-size: 3vh;
                    }
                `}</style>
            </div>
        )
    }
}