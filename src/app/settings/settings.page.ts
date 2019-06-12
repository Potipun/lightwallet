import { Component, OnInit } from '@angular/core';
import { WalletGuard } from '../guards/wallet.guard';
import { AlertController } from '@ionic/angular';
import { AccountService } from '../services/account.service';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
})
export class SettingsPage implements OnInit {

  saved_accounts_name: any = [];

  constructor(
    private auth: WalletGuard,
    private alertCtrl: AlertController,
    private accountService: AccountService,
    private translate: TranslateService,
  ) {

    this.accountService.getSavedAccounts()
      .then((accounts) => this.saved_accounts_name = (accounts && accounts.length >= 1) ? accounts.map(account => account.name) : [])

  }

  ngOnInit() {
  }

  /**
   * Logout dialog
   */
  logout() {
    this.accountService.getSessionAccountInfo()
      .then((account_info) => {
        if (account_info) {
          this.alertShowLogout()
          console.log("Oh, you have some account info")
        } else {
          console.log("No account info, direct logout")
          this.auth.logout()
        }
      })
  }

  private forgetAccountHandler = () => {
    return this.accountService.getAccountName()
      .then((account_name) => this.accountService.deleteAccount(account_name))
      .then(() => this.auth.logout())
  }

  private saveAccountHandler = () => {
    return this.accountService.getAccountName()
      .then((current_username) => {
        if (current_username) {
          this.saveAccount(current_username);
        } else {
          this.alertAskUsername('TITLE_DEFAULT', 'TEXT_DEFAULT')
        }
      })
  }

  saveAccount(username) {
    this.accountService.saveAccount(username)
      .then(() => this.auth.logout())
      .catch((error) => {
        //this.alert.showError('MESSAGE.ERR_SAVE_ACCOUNT', error.message)
      })
  }

  async alertShowLogout() {
    const translations = await this.translate.get([
      'TITLE',
      'TEXT',
      'BUTTON.SAVE',
      'BUTTON.FORGET',
      'BUTTON.BACK',
    ].map(key => 'ACCOUNT_MANAGEMENT.LOGOUT.' + key)).toPromise();
    const alert = await this.alertCtrl.create({
      header: translations['ACCOUNT_MANAGEMENT.LOGOUT.TITLE'],
      message: translations['ACCOUNT_MANAGEMENT.LOGOUT.TEXT'],
      buttons: [
        {
          text: translations['ACCOUNT_MANAGEMENT.LOGOUT.BUTTON.SAVE'],
          handler: () => this.saveAccountHandler()
        }, {
          text: translations['ACCOUNT_MANAGEMENT.LOGOUT.BUTTON.FORGET'],
          handler: () => this.forgetAccountHandler()
        }, {
          text: translations['ACCOUNT_MANAGEMENT.LOGOUT.BUTTON.BACK'],
        }
      ]
    });
    alert.present();
  }

  async alertAskUsername(title, text) {
    const translations = await this.translate.get([
      title,
      text,
      'INPUT.PLACEHOLDER',
      'BUTTON.OK',
    ].map(key => 'ACCOUNT_MANAGEMENT.LOGOUT_ASK_USERNAME.' + key)).toPromise();
    const alert = await this.alertCtrl.create({
      header: translations['ACCOUNT_MANAGEMENT.LOGOUT_ASK_USERNAME.' + title],
      message: translations['ACCOUNT_MANAGEMENT.LOGOUT_ASK_USERNAME.' + text],
      inputs: [
        { name: 'username', placeholder: translations['ACCOUNT_MANAGEMENT.LOGOUT_ASK_USERNAME.INPUT.PLACEHOLDER'], type: 'text' }
      ],
      buttons: [
        {
          text: translations['ACCOUNT_MANAGEMENT.LOGOUT_ASK_USERNAME.BUTTON.OK'],
          handler: (data) => this.checkUsername(data.username)
        }
      ]
    });
    alert.present();
  }

  checkUsername(username) {
    if (!username) {
      this.alertAskUsername('TITLE_NO_NAME', 'TEXT_NO_NAME')
    } else if (this.saved_accounts_name.indexOf(username) != -1) {
      this.alertAskUsername('TITLE_ALREADY_EXIST', 'TEXT_ALREADY_EXIST')
    } else {
      this.saveAccount(username);
    }
  }

}