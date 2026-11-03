import {
  RouteLocation,
  defaultComponentMocks,
  defaultPlugins,
  shallowMount
} from '@opencloud-eu/web-test-helpers'
import oidcCallback from '../../../src/pages/oidcCallback.vue'
import { authService } from '../../../src/services/auth'
import { mock } from 'vitest-mock-extended'
import { computed } from 'vue'

const mockUseEmbedMode = vi.fn()

vi.mock('@opencloud-eu/web-pkg', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  useRoute: vi.fn().mockReturnValue({ query: {} }),
  useEmbedMode: vi.fn().mockImplementation(() => mockUseEmbedMode())
}))

const postMessageMock = vi.fn()
console.debug = vi.fn()

describe('oidcCallback page', () => {
  describe('delegated authentication', () => {
    it('when authentication is delegated does not call signInCallback immediately', () => {
      mockUseEmbedMode.mockReturnValue({
        isDelegatingAuthentication: computed(() => true),
        postMessage: postMessageMock,
        verifyDelegatedAuthenticationOrigin: vi.fn().mockReturnValue(true)
      })

      const signInCallbackSpy = vi
        .spyOn(authService, 'signInCallback')
        .mockImplementation(() => Promise.resolve())

      getWrapper()

      expect(signInCallbackSpy).not.toHaveBeenCalled()
    })

    it('when authentication is not delegated calls signInCallback immediately', () => {
      mockUseEmbedMode.mockReturnValue({
        isDelegatingAuthentication: computed(() => false),
        verifyDelegatedAuthenticationOrigin: vi.fn().mockReturnValue(true)
      })

      const signInCallbackSpy = vi
        .spyOn(authService, 'signInCallback')
        .mockImplementation(() => Promise.resolve())

      getWrapper()

      expect(signInCallbackSpy).toHaveBeenCalled()
    })

    it('when authentication is delegated calls postMessage with token request event', () => {
      mockUseEmbedMode.mockReturnValue({
        isDelegatingAuthentication: computed(() => true),
        postMessage: postMessageMock,
        verifyDelegatedAuthenticationOrigin: vi.fn().mockReturnValue(true)
      })

      vi.spyOn(authService, 'signInCallback').mockImplementation(() => Promise.resolve())

      getWrapper()

      expect(postMessageMock).toHaveBeenCalledWith('opencloud-embed:request-token')
    })

    it('when token update event is received calls signInCallback', async () => {
      mockUseEmbedMode.mockReturnValue({
        isDelegatingAuthentication: computed(() => true),
        postMessage: postMessageMock,
        verifyDelegatedAuthenticationOrigin: vi.fn().mockReturnValue(true)
      })

      const signInCallbackSpy = vi
        .spyOn(authService, 'signInCallback')
        .mockImplementation(() => Promise.resolve())

      getWrapper()

      window.postMessage(
        {
          name: 'opencloud-embed:update-token',
          data: { access_token: 'access-token', session_id: 'session-id' }
        },
        '*'
      )

      await new Promise<void>((resolve) => setTimeout(() => resolve(), 10))

      expect(signInCallbackSpy).toHaveBeenCalledWith('access-token', 'session-id')
    })

    it('ignores a token update event without an access token and keeps listening', () => {
      mockUseEmbedMode.mockReturnValue({
        isDelegatingAuthentication: computed(() => true),
        postMessage: postMessageMock,
        verifyDelegatedAuthenticationOrigin: vi.fn().mockReturnValue(true)
      })

      const signInCallbackSpy = vi
        .spyOn(authService, 'signInCallback')
        .mockImplementation(() => Promise.resolve())
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener')

      getWrapper()

      const [, handler] = addEventListenerSpy.mock.calls.find(([type]) => type === 'message')
      const listener = handler as (event: MessageEvent) => void

      expect(() =>
        listener(new MessageEvent('message', { data: { name: 'opencloud-embed:update-token' } }))
      ).not.toThrow()
      listener(
        new MessageEvent('message', { data: { name: 'opencloud-embed:update-token', data: {} } })
      )
      expect(signInCallbackSpy).not.toHaveBeenCalled()

      listener(
        new MessageEvent('message', {
          data: {
            name: 'opencloud-embed:update-token',
            data: { access_token: 'access-token', session_id: 'session-id' }
          }
        })
      )
      expect(signInCallbackSpy).toHaveBeenCalledWith('access-token', 'session-id')

      addEventListenerSpy.mockRestore()
    })

    it('when token update event is received but name is incorrect does not call signInCallback', async () => {
      mockUseEmbedMode.mockReturnValue({
        isDelegatingAuthentication: computed(() => true),
        postMessage: postMessageMock,
        verifyDelegatedAuthenticationOrigin: vi.fn().mockReturnValue(true)
      })

      const signInCallbackSpy = vi
        .spyOn(authService, 'signInCallback')
        .mockImplementation(() => Promise.resolve())

      getWrapper()

      window.postMessage(
        {
          name: 'update-token',
          data: { access_token: 'access-token' }
        },
        '*'
      )

      await new Promise<void>((resolve) => setTimeout(() => resolve(), 10))

      expect(signInCallbackSpy).not.toHaveBeenCalled()
    })
  })
})

function getWrapper() {
  const mocks = {
    ...defaultComponentMocks({
      currentRoute: mock<RouteLocation>({ query: {} })
    })
  }

  return {
    wrapper: shallowMount(oidcCallback, {
      global: {
        plugins: [
          ...defaultPlugins({
            piniaOptions: { configState: { server: 'http://server/address/' } }
          })
        ],
        mocks,
        provide: {}
      }
    })
  }
}
