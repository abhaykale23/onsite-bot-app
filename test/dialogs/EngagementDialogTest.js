import EngagementDialog from '../../js/dialogs/EngagementDialog';
import {SENDERS} from '../../js/Constants';
import memo from 'memo-is';

describe('EngagementDialog', () => {
  let sendMessage;
  let getMessages;
  let finish;
  let smChat;
  const params = memo().is(() => ({}));
  const salemove = memo().is(() => ({
    ERRORS: {
      OPERATOR_DECLINED: 'operator_declined',
      OPERATOR_UNAVAILABLE: 'operator unavailable'
    },
    requestEngagement: sinon.stub()
  }));
  let dialog;
  const engagementPromise = memo().is(() => Promise.reject());

  beforeEach(() => {
    smChat = {
      sendMessage: sinon.stub()
    };
    sendMessage = sinon.stub();
    getMessages = sinon.stub();
    finish = sinon.stub();
    salemove().requestEngagement.returns({engagementPromise: engagementPromise()});

    EngagementDialog.__Rewire__('SmChat', () => smChat);
    dialog = new EngagementDialog({salemove: salemove(), finish, sendMessage, getMessages}, params());
    dialog.onStart();
  });

  it('requests text Engagement', () => {
    expect(salemove().requestEngagement).to.be.calledWith('text');
  });

  context('when Operator provided', () => {
    const operator = {name: 'El', id: 1};
    params.is(() => ({operator}));
    it('requests text Engagement with Operator', () => {
      expect(salemove().requestEngagement).to.be.calledWith('text', {operatorId: operator.id});
    });
  });

  context('when Engagement accepted', () => {
    const chatEvents = {MESSAGES: 'messages'};
    const engagementEvents = {END: 'end'};
    const chat = memo().is(() => ({
      EVENTS: chatEvents,
      addEventListener: sinon.stub()
    }));
    const engagement = memo().is(() => ({
      EVENTS: engagementEvents,
      chat: chat(),
      addEventListener: sinon.stub(),
      end: sinon.stub()
    }));
    engagementPromise.is(() => Promise.resolve(engagement()));

    it('sends ENGAGEMENT_STARTED message as Bot', () => {
      expect(sendMessage).to.be.calledWith(dialog.RESPONSES.ENGAGEMENT_STARTED, SENDERS.BOT);
    });

    const triggerChatMessagesEvent = message => chat.is(() => {
      const addEventListener = sinon.stub();
      addEventListener.withArgs(chatEvents.MESSAGES).callsArgWith(1, [message]);
      return {EVENTS: chatEvents, addEventListener};
    });

    context('when Operator message received from API', () => {
      const message = {content: 'Hello', sender: SENDERS.OPERATOR};
      triggerChatMessagesEvent(message);

      it('sends message to Visitor as Operator', () => {
        expect(sendMessage).to.be.calledWith(message.content, SENDERS.OPERATOR);
      });
    });

    context('when Visitor message received from API', () => {
      const message = {content: 'Hello', sender: SENDERS.VISITOR};
      triggerChatMessagesEvent(message);

      it('skips message', () => {
        expect(sendMessage).to.not.be.calledWith(message.content, sinon.match.any);
      });
    });

    context('when onMessage triggered', () => {
      const message = {content: 'Hello', sender: SENDERS.VISITOR};
      beforeEach(() => {
        dialog.onMessage(message);
      });

      it('sends message to Operator', () => {
        expect(smChat.sendMessage).to.be.calledWith(message.content);
      });
    });

    context('when Engagement ends', () => {
      engagement.is(() => {
        const addEventListener = sinon.stub();
        addEventListener.withArgs(engagementEvents.END).callsArg(1);
        return {chat: chat(), EVENTS: engagementEvents, addEventListener};
      });

      it('sends ENGAGEMENT_ENDED message as Bot', () => {
        expect(sendMessage).to.be.calledWith(dialog.RESPONSES.ENGAGEMENT_ENDED, SENDERS.BOT);
      });

      it('finishes dialog', () => {
        expect(finish).to.be.called;
      });
    });

    context('when Visitor sends stop message', () => {
      const message = {content: 'stop', sender: SENDERS.VISITOR};
      beforeEach(() => {
        dialog.onMessage(message);
      });

      it('ends the Engagement', () => {
        expect(engagement().end).to.be.called;
      });
    });
  });

  context('when Engagement declined', () => {
    engagementPromise.is(() => Promise.reject({cause: salemove().ERRORS.OPERATOR_DECLINED}));

    it('sends OPERATOR_NOT_AVAILABLE message as Bot', () => {
      expect(sendMessage).to.be.calledWith(dialog.RESPONSES.OPERATOR_NOT_AVAILABLE, SENDERS.BOT);
    });

    it('finishes dialog', () => {
      expect(finish).to.be.called;
    });
  });

  context('when no Operators available', () => {
    engagementPromise.is(() => Promise.reject({cause: salemove().ERRORS.OPERATOR_UNAVAILABLE}));

    it('sends NO_OPERATORS_AVAILABLE message as Bot', () => {
      expect(sendMessage).to.be.calledWith(dialog.RESPONSES.NO_OPERATORS_AVAILABLE, SENDERS.BOT);
    });

    it('finishes dialog', () => {
      expect(finish).to.be.called;
    });
  });
});
