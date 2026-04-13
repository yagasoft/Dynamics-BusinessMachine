import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { providePrimeNG } from 'primeng/config';
import { of } from 'rxjs';
import { MSAL_GUARD_CONFIG, MSAL_INSTANCE, MsalService } from '@azure/msal-angular';
import { AppComponent } from './app.component';

describe('AppComponent', () =>
{
	beforeEach(async () =>
	{
		const xrmMock = {
			Utility: {
				getGlobalContext: () => ({
					getClientUrl: () => 'https://example.crm.dynamics.com'
				})
			}
		};

		(globalThis as any).Xrm = xrmMock;
		if (window.parent)
		{
			(window.parent as any).Xrm = xrmMock;
		}

		(globalThis as any).Ys = {
			Common: {
				retrieveRecords: async () => [],
				buildWebApiHeaders: () => new Headers()
			}
		};

		await TestBed.configureTestingModule({
			imports: [AppComponent],
			providers: [
				provideHttpClient(),
				provideRouter([]),
				provideAnimations(),
				providePrimeNG({
					theme: 'none',
					ripple: false
				}),
				{
					provide: MSAL_GUARD_CONFIG,
					useValue: {}
				},
				{
					provide: MSAL_INSTANCE,
					useValue: {
						addEventCallback: () => 'callback-id',
						removeEventCallback: () => undefined,
						getAllAccounts: () => [],
						getActiveAccount: () => null,
						setActiveAccount: () => undefined
					}
				},
				{
					provide: MsalService,
					useValue: {
						initialize: () => of(void 0),
						handleRedirectObservable: () => of(null),
						loginRedirect: () => undefined,
						loginPopup: () => of({ account: { username: 'test@example.com' }, accessToken: 'token' }),
						logoutPopup: () => undefined,
						logoutRedirect: () => undefined,
						instance: {
							getAllAccounts: () => [],
							getActiveAccount: () => null,
							setActiveAccount: () => undefined,
							acquireTokenSilent: async () => ({ accessToken: 'token' }),
							acquireTokenPopup: async () => ({ accessToken: 'token' })
						}
					}
				}
			]
		}).compileComponents();
	});

	afterEach(() =>
	{
		delete (globalThis as any).Xrm;
		delete (globalThis as any).Ys;
		if (window.parent)
		{
			delete (window.parent as any).Xrm;
		}
	});

	it('renders the model browser when host context is already available', () =>
	{
		const fixture = TestBed.createComponent(AppComponent);
		fixture.detectChanges();

		expect(fixture.componentInstance.isReady).toBeTrue();
		expect(fixture.nativeElement.querySelector('ys-resources-list')).not.toBeNull();
	});
});
