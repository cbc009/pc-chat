import { observable, action } from 'mobx';
import proto from 'node-loader!../../../node_modules/marswrapper.node';
import * as wfcMessage from '../wfc/messageConfig'
import Message from '../wfc/messages/message';
import Conversation from '../wfc/conversation';
import ConversationInfo from '../wfc/conversationInfo';
import MessageContent from '../wfc/messages/messageContent';
import { EventEmitter } from 'events';
import { EventTypeReceiveMessage, EventTypeSendMessage, EventTypeMessageStatusUpdate, EventTypeUserInfoUpdate } from '../wfc/wfcEvents'
import UserInfo from '../wfc/model/userInfo';
import NullUserInfo from '../wfc/model/nullUserInfo';

// TODO remove mobx related code from this class
// @observable
// @action
class WfcManager {
    @observable connectionStatus = 0;
    @observable userId = '';
    @observable token = '';

    onReceiveMessageListeners = [];

    messageContentList = new Map();

    eventEmitter = new EventEmitter();

    @action onConnectionChanged(status) {
        self.connectionStatus = status;
        console.log('connection status changed', status);
    }

    onReceiveMessage(messages, hasMore) {
        var msgs = JSON.parse(messages);
        msgs.map(m => {
            let msg = Message.protoMessageToMessage(m);
            console.log(msg.messagecontent);
            self.onReceiveMessageListeners.forEach(listener => {
                listener(msg, hasMore);
            });

            self.eventEmitter.emit(EventTypeReceiveMessage, msg);
        });
    }

    onUserInfoUpdate(userIds) {
        console.log('userIndo update, ids', userIds);
        userIds.map((userId => {
            self.eventEmitter.emit(EventTypeUserInfoUpdate, userId);
        }))
    }

    onFriendListUpdate(friendListIds) {
        console.log('friendList update, ids', friendListIds);
    }

    async init() {
        proto.setConnectionStatusListener(self.onConnectionChanged);
        proto.setReceiveMessageListener(self.onReceiveMessage);
        proto.setUserInfoUpdateListener(self.onUserInfoUpdate);
        proto.setFriendUpdateListener(self.onFriendListUpdate);
        self.registerDefaultMessageContents();
    }

    /**
     * 
     * @param {messagecontent} content 
     */
    registerMessageContent(type, content) {
        self.messageContentList[type] = content;
    }

    async setServerAddress(host, port) {
        proto.setServerAddress(host, port);
    }

    async connect(userId, token) {
        await self.setServerAddress("wildfirechat.cn", 80);
        proto.connect(userId, token);

        // for testing your code
        self.test();
    }

    registerDefaultMessageContents() {
        wfcMessage.MessageContents.map((e) => {
            proto.registerMessageFlag(e.type, e.flag);
            self.registerMessageContent(e.type, e.content);
        });
    }

    /**
     * @param {string} userId 
     * @param {bool} fresh 
     */
    getUserInfo(userId, fresh = false) {
        let userInfoStr = proto.getUserInfo(userId, fresh);
        if (userInfoStr === '') {
            return new NullUserInfo(userId);
        } else {
            return Object.assign(new UserInfo(), JSON.parse(userInfoStr));
        }
    }

    getMyFriendList(fresh = false) {
        return proto.getMyFriendList(fresh);
    }

    /**
     * 
     * @param {function} listener 
     */
    setOnReceiveMessageListener(listener) {
        if (typeof listener !== 'function') {
            console.log('listener should be a function');
            return;
        }
        self.onReceiveMessageListeners.forEach(l => {
            l === listener
            return
        });
        self.onReceiveMessageListeners.push(listener);
    }

    removeOnReceiMessageListener(listener) {
        if (typeof listener !== 'function') {
            console.log('listener should be a function');
            return;
        }
        self.onReceiveMessageListeners.splice(self.onReceiveMessageListeners.indexOf(listener), 1);
    }

    @action async getConversationList(types, lines) {
        var conversationListStr = proto.getConversationInfos(types, lines);
        // console.log(conversationListStr);
        // TODO convert to conversationInfo, messageContent

        let conversationInfoList = [];
        let tmp = JSON.parse(conversationListStr);
        tmp.forEach(c => {
            conversationInfoList.push(ConversationInfo.protoConversationToConversationInfo(c));
        });

        return conversationInfoList;
    }

    @action async getConversationInfo(conversation) {

    }

    /**
     * 
     * @param {Conversation} conversation
     * @param {number} fromIndex 
     * @param {boolean} before 
     * @param {number} count 
     * @param {string} withUser 
     */
    @action async getMessages(conversation, fromIndex, before = true, count = 20, withUser = '') {
        let protoMsgsStr = proto.getMessages(JSON.stringify(conversation), [], fromIndex, before, count, withUser);
        // let protoMsgsStr = proto.getMessages('xxx', [0], fromIndex, before, count, withUser);
        var protoMsgs = JSON.parse(protoMsgsStr);
        let msgs = [];
        protoMsgs.map(m => {
            let msg = Message.protoMessageToMessage(m);
            msgs.push(msg);
        });
        console.log('getMessages', msgs.length);

        return msgs;
    }

    @action async getMessageById(messageId) {

    }

    @action async getMessageByUid(messageUid) {

    }


    async sendMessage(message, preparedCB, uploadedCB, successCB, failCB) {
        let strConv = JSON.stringify(message.conversation);
        message.content = message.messageContent.encode();
        let strCont = JSON.stringify(message.content);

        proto.sendMessage(strConv, strCont, "", 0, function (messageId, timestamp) { //preparedCB
            if (typeof preparedCB === 'function') {
                preparedCB(messageId, Number(timestamp));
            }
        }, function (uploaded, total) { //progressCB
            if (typeof uploadedCB === 'function') {
                uploadedCB(uploaded, total);
            }
        }, function (messageUid, timestamp) { //successCB
            if (typeof successCB === 'function') {
                successCB(Number(messageUid), timestamp);
            }
        }, function (errorCode) { //errorCB
            if (typeof failCB === 'function') {
                failCB(errorCode);
            }
        });

        self.eventEmitter.emit(EventTypeSendMessage, message);
    }

    test() {

        // let u = proto.getUserInfo('uiuJuJcc', true)
        // let u1 = Object.assign(new UserInfo(), JSON.parse(u));
        // u1.hello();

        let u = self.getUserInfo('uiuJuJccj', true);
        u.hello();
        console.log('user info', u);

    }
}
const self = new WfcManager();
export default self;