import { Component } from '@angular/core';
import { IonicPage, NavController, Platform, Events } from 'ionic-angular';
import { TranslateService } from '@ngx-translate/core';
import { AlertProvider } from '../../providers/alert/alert';
import { MvsServiceProvider } from '../../providers/mvs-service/mvs-service';
import { WalletServiceProvider } from '../../providers/wallet-service/wallet-service';

class Ticker {
    market_cap: number
    percent_change_1h: number
    percent_change_7d: number
    percent_change_24h: number
    price: number
    volume_24h: number
}

class BaseTickers {
    BTC: Ticker
    USD: Ticker
    CNY: Ticker
    EUR: Ticker
    JPY: Ticker
}

@IonicPage()
@Component({
    selector: 'page-account',
    templateUrl: 'account.html'
})
export class AccountPage {

    syncing = false
    syncingSmall = false
    offline = false
    balances: any
    height: number
    loading: boolean
    balancesKeys: any
    theme: string
    icons: any = []
    tickers = {}
    base: string
    domains: any = []
    whitelist: any = []
    saved_accounts_name: any = [];

    private syncinterval: any;

    constructor(
        public nav: NavController,
        public translate: TranslateService,
        private wallet: WalletServiceProvider,
        private mvs: MvsServiceProvider,
        private alert: AlertProvider,
        public platform: Platform,
        private event: Events,
    ) {

        this.loading = true;
        //Reset last update time
        var lastupdate = new Date()
        this.mvs.setUpdateTime(lastupdate)

        this.theme = document.getElementById('theme').className
        this.event.subscribe("theme_changed", (theme) => {
            this.theme = ('theme-' + theme)
        });

        this.wallet.getSavedAccounts()
            .then((accounts) => this.saved_accounts_name = (accounts && accounts.length >= 1) ? accounts.map(account => account.name) : [])

    }

    isOffline = () => !this.syncingSmall && this.offline
    isSyncing = () => this.syncingSmall

    async ionViewDidEnter() {

        if (await this.checkAccess()) {
            this.loadTickers()
            this.initialize()
            try {
                this.whitelist = await this.mvs.getWhitelist()
            } catch (e) {
                console.error(e);
            }
            
        }
        else
            this.nav.setRoot("LoginPage")
    }

    private async checkAccess() {
        let addresses = await this.mvs.getAddresses()
        return Array.isArray(addresses) && addresses.length
    }

    private async loadTickers() {
        this.base = await this.mvs.getBaseCurrency()
        this.mvs.getTickers()
            .then(tickers => {
                Object.keys(tickers).forEach((symbol) => {
                    let ticker: BaseTickers = tickers[symbol];
                    this.tickers[symbol] = ticker;
                })
            })

    }

    private loadFromCache() {
        return this.showBalances()
            .then(() => this.mvs.getHeight())
            .then((height: number) => {
                this.height = height
                return height
            })
    }

    private initialize = () => {

        this.syncinterval = setInterval(() => this.update(), 5000)

        return this.mvs.getDbUpdateNeeded()
            .then((target: any) => {
                if (target)
                    this.nav.setRoot("LoadingPage", { reset: true })
                return this.loadFromCache()
            })
            .then(() => this.update())

    }

    private update = async () => {
        return (await this.mvs.getUpdateNeeded()) ? this.sync()
            .then(() => this.mvs.setUpdateTime())
            .catch(() => console.log("Can't update")) : null
    }

    ionViewWillLeave = () => clearInterval(this.syncinterval)

    logout() {
        this.wallet.getSessionAccountInfo()
            .then((account_info) => {
                if(account_info) {
                    this.alert.showLogout(this.saveAccountHandler, this.forgetAccountHandler)
                } else {
                    this.alert.showLogoutNoAccount(() => this.mvs.hardReset()
                          .then(() => this.nav.setRoot("LoginPage")))
                }
            })
    }

    newUsername(title, message, placeholder) {
        this.askUsername(title, message, placeholder)
            .then((username) => {
                if (!username) {
                    this.newUsername('SAVE_ACCOUNT_TITLE_NO_NAME', 'SAVE_ACCOUNT_MESSAGE', placeholder)
                } else if (this.saved_accounts_name.indexOf(username) != -1) {
                    this.newUsername('SAVE_ACCOUNT_TITLE_ALREADY_EXIST', 'SAVE_ACCOUNT_MESSAGE_ALREADY_EXIST', placeholder)
                } else {
                    this.saveAccount(username);
                }
            })
    }

    private forgetAccountHandler = () => {
        return this.wallet.getAccountName()
            .then((account_name) => this.wallet.deleteAccount(account_name))
            .then(() => this.mvs.hardReset())
            .then(() => this.nav.setRoot("LoginPage"))
    }

    private saveAccountHandler = () => {
        return this.wallet.getAccountName()
            .then((current_username) => {
                if (current_username) {
                    this.saveAccount(current_username);
                } else {
                    this.newUsername('SAVE_ACCOUNT_TITLE', 'SAVE_ACCOUNT_MESSAGE', 'SAVE_ACCOUNT_PLACEHOLDER')
                }
            })
    }

    askUsername(title, message, placeholder) {
        return new Promise((resolve, reject) => {
            this.translate.get([title, message, placeholder]).subscribe((translations: any) => {
                this.alert.askInfo(translations[title], translations[message], translations[placeholder], 'text', (info) => {
                    resolve(info)
                })
            })
        })
    }

    saveAccount(username) {
        this.wallet.saveAccount(username)
            .then(() => this.mvs.hardReset())
            .then(() => this.nav.setRoot("LoginPage"))
            .catch((error) => {
                this.alert.showError('MESSAGE.ERR_SAVE_ACCOUNT', error.message)
            })
    }

    sync(refresher = undefined) {
        //Only allow a single sync process
        if (this.syncing) {
            this.syncingSmall = false
            return Promise.resolve()
        } else {
            this.syncing = true
            this.syncingSmall = true
            return Promise.all([this.mvs.updateHeight(), this.updateBalances()])
                .then(([height, balances]) => {
                    this.height = height
                    this.syncing = false
                    this.syncingSmall = false
                    if (refresher)
                        refresher.complete()
                    this.offline = false
                })
                .catch((error) => {
                    console.error(error)
                    this.syncing = false

                    this.syncingSmall = false
                    if (refresher)
                        refresher.complete()
                    this.offline = true
                })
        }
    }

    private updateBalances = async () => {
        return this.mvs.getData()
            .then(() => {
                this.showBalances()
                return this.mvs.setUpdateTime()
            })
            .catch((error) => console.error("Can't update balances: " + error))
    }

    private showBalances() {
        return this.mvs.getBalances()
            .then((_) => {
                this.balances = _
                return this.mvs.addAssetsToAssetOrder(Object.keys(_.MST))
            })
            .then(() => this.mvs.assetOrder())
            .then((order) => {
                this.loading = false
                this.balancesKeys = order
                return order
            })
            .then((balances) => {
                let iconsList = this.wallet.getMstIcons()
                balances.map((symbol) => {
                    this.icons[symbol] = iconsList.indexOf(symbol) !== -1 ? symbol : 'default_mst'
                    this.domains[symbol] = symbol.split('.')[0]
                })
            })
            .catch((e) => {
                console.error(e)
                console.log("Can't load balances")
            })
    }

}
