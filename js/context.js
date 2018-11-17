import React from 'react'
import { filterObject } from './common/utility'

export const IndicatorContext = React.createContext()
export const ModalContext = React.createContext()
export const UserContext = React.createContext()

export default class Context extends React.Component {
    constructor() {
        super()

        this.state = {
            isLoading: false,
            indicatorMessage: '',
            currentUser: null,
            isModalOpen: false,
            modalMessage: '',
            errorInfo: '',
            modalCloseCallback: () => {},
            modalOKCallback: () => {},
            modalCancelCallback: () => {}
        }

        // TODO get user by localstorage token
    }

    updateIndicator(indicatorState) {
        const needsStateKeys = ['isLoading', 'indicatorMessage']
        const filteredState = filterObject(indicatorState, needsStateKeys)
        const newState = Object.assign({}, this.state, filteredState)
        this.setState(newState)
    }

    updateUser(user) {
        this.setState({ currentUser: user })
    }

    updateModal(modalState) {
        const needsStateKeys = [
            'isModalOpen',
            'modalMessage',
            'errorInfo',
            'modalCloseCallback',
            'modalOKCallback',
            'modalCancelCallback'
        ]
        const filteredState = filterObject(modalState, needsStateKeys)
        const newState = Object.assign({}, this.state, filteredState)
        this.setState(newState)
    }

    render() {
        return (
            <IndicatorContext.Provider
                value={{
                    isLoading: this.state.isLoading,
                    indicatorMessage: this.state.indicatorMessage,
                    updateIndicator: this.updateIndicator.bind(this)
                }}
            >
                <ModalContext.Provider
                    value={{
                        isModalOpen: this.state.isModalOpen,
                        modalMessage: this.state.modalMessage,
                        modalCloseCallback: this.state.modalCloseCallback,
                        modalOKCallback: this.state.modalOKCallback,
                        modalCancelCallback: this.state.modalCancelCallback,
                        updateModal: this.updateModal.bind(this)
                    }}
                >
                    <UserContext.Provider
                        value={{
                            currentUser: this.state.currentUser,
                            updateUser: this.updateUser.bind(this)
                        }}
                    >
                        {this.props.children}
                    </UserContext.Provider>
                </ModalContext.Provider>
            </IndicatorContext.Provider>
        )
    }
}