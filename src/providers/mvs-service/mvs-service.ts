import { Injectable } from '@angular/core';
import { Events } from 'ionic-angular';
import { AppGlobals } from '../../app/app.global';
import { Storage } from '@ionic/storage';
import { WalletServiceProvider } from '../wallet-service/wallet-service';
import Metaverse from 'metaversejs/index.js';
import Blockchain from 'mvs-blockchain';

@Injectable()
export class MvsServiceProvider {

    private blockchain;

    DEFAULT_BALANCES = {
        ETP: { frozen: 0, available: 0, decimals: 8 },
        MST: {
            "PARCELX.GPX": { frozen: 0, available: 0, decimals: 8 },
            "RIGHTBTC.RT": { frozen: 0, available: 0, decimals: 4 },
            "MVS.ZGC": { frozen: 0, available: 0, decimals: 8 },
            "MVS.ZDC": { frozen: 0, available: 0, decimals: 6 },
            "SDG": { frozen: 0, available: 0, decimals: 8 }
        },
        MIT: []
    }

    constructor(
        public globals: AppGlobals,
        private wallet: WalletServiceProvider,
        private event: Events,
        private storage: Storage
    ) {
        this.event.subscribe("network_update", (settings) => {
            console.info('mvs service network update caused by network update event')
            this.blockchain = Blockchain({ network: this.globals.network })
        })
        this.globals.getNetwork()
            .then(network => {
                this.blockchain = Blockchain({ network: network })
            })
    }

    createSendTx(passphrase: string, asset: string, recipient_address: string, recipient_avatar: string, quantity: number, from_address: string, change_address: string, fee: number, messages: Array<string>) {
        console.log(passphrase, asset, recipient_address, recipient_avatar, quantity, from_address, change_address, fee, messages)
        let target = {};
        target[asset] = quantity;
        return this.wallet.getWallet(passphrase)
            .then(wallet => this.getUtxoFrom(from_address)
                .then((utxo) => this.getHeight().then(height => Metaverse.output.findUtxo(utxo, target, height, fee)))
                .then((result) => {
                    if (result.utxo.length > 676) {
                        throw Error('ERR_TOO_MANY_INPUTS');
                    }
                    //Set change address to first utxo's address
                    if (change_address == undefined)
                        change_address = result.utxo[0].address;
                    return Metaverse.transaction_builder.send(result.utxo, recipient_address, recipient_avatar, target, change_address, result.change, result.lockedAssetChange, fee, messages);
                })
                .then((tx) => wallet.sign(tx)))
            .catch((error) => {
                console.error(error)
                throw Error(error.message);
            })
    }

    createSendMultisigTx(passphrase: string, asset: string, recipient_address: string, recipient_avatar: string, quantity: number, from_address: string, change_address: string, fee: number, messages: Array<string>, multisig: any) {
        let target = {};
        target[asset] = quantity;
        return this.wallet.getWallet(passphrase)
            .then(wallet => this.getUtxoFromMultisig(from_address)
                .then((utxo) => this.getHeight().then(height => Metaverse.output.findUtxo(utxo, target, height, fee)))
                .then((result) => {
                    if (result.utxo.length > 676) {
                        throw Error('ERR_TOO_MANY_INPUTS');
                    }
                    //Set change address to first utxo's address
                    if (change_address == undefined)
                        change_address = result.utxo[0].address;
                    return Metaverse.transaction_builder.send(result.utxo, recipient_address, recipient_avatar, target, change_address, result.change, undefined, fee, messages);
                })
                .then((tx) => wallet.signMultisig(tx, multisig)))
            .catch((error) => {
                console.error(error)
                throw Error(error.message);
            })
    }

    createSendMoreTx(passphrase: string, target: any, recipients: Array<any>, from_address: string, change_address: string, messages: Array<string>) {
        return this.wallet.getWallet(passphrase)
            .then(wallet => this.getUtxoFrom(from_address)
                .then((utxo) => this.getHeight().then(height => Metaverse.output.findUtxo(utxo, target, height, Metaverse.constants.FEE.DEFAULT * recipients.length)))
                .then((result) => {
                    //Set change address to first utxo's address
                    if (change_address == undefined)
                        change_address = result.utxo[0].address;
                    return Metaverse.transaction_builder.sendMore(result.utxo, recipients, change_address, result.change, undefined, Metaverse.constants.FEE.DEFAULT * recipients.length, messages);
                })
                .then((tx) => wallet.sign(tx)))
            .catch((error) => {
                console.error(error)
                throw Error(error.message);
            })
    }

    createSendSwapTx(passphrase: string, asset: string, recipient_address: string, recipient_avatar: string, quantity: number, from_address: string, change_address: string, fee: number, messages: Array<string>, swap_fee: number) {
        let target = {};
        target[asset] = quantity;
        return this.wallet.getWallet(passphrase)
            .then(wallet => this.getUtxoFrom(from_address)
                .then((utxo) => this.getHeight().then(height => Metaverse.output.findUtxo(utxo, target, height, fee + swap_fee)))
                .then((result) => {
                    if (result.utxo.length > 676) {
                        throw Error('ERR_TOO_MANY_INPUTS');
                    }
                    //Set change address to first utxo's address
                    if (change_address == undefined)
                        change_address = result.utxo[0].address;
                    return Metaverse.transaction_builder.sendSwap(result.utxo, recipient_address, recipient_avatar, target, change_address, result.change, undefined, fee, this.globals.network, messages, swap_fee);
                })
                .then((tx) => wallet.sign(tx)))
            .catch((error) => {
                console.error(error)
                throw Error(error.message);
            })
    }

    createAssetDepositTx(passphrase: string, recipient_address: string, recipient_avatar: string, symbol: string, quantity: number, attenuation_model: string, from_address: string, change_address: string, fee: number, messages: Array<string>) {
        let target = { [symbol]: quantity };
        return this.wallet.getWallet(passphrase)
            .then(wallet => this.getUtxoFrom(from_address)
                .then((utxo) => this.getHeight().then(height => Metaverse.output.findUtxo(utxo, target, height, fee)))
                .then((result) => {
                    if (result.utxo.length > 676) {
                        throw Error('ERR_TOO_MANY_INPUTS');
                    }
                    //Set change address to first utxo's address
                    if (change_address == undefined)
                        change_address = result.utxo[0].address;
                    if (recipient_address == undefined)
                        recipient_address = result.utxo[0].address;
                    return Metaverse.transaction_builder.sendLockedAsset(result.utxo, recipient_address, recipient_avatar, symbol, quantity, attenuation_model, change_address, result.change, undefined, fee, messages);
                })
                .then((tx) => wallet.sign(tx)))
            .catch((error) => {
                console.error(error)
                throw Error(error.message);
            })
    }

    createAvatarTx(passphrase: string, avatar_address: string, symbol: string, change_address: string, bounty_fee: number, messages: Array<string>) {
        return this.wallet.getWallet(passphrase)
            .then(wallet => this.getUtxoFrom(avatar_address)
                .then((utxo) => this.getHeight().then(height => Metaverse.output.findUtxo(utxo, {}, height, Metaverse.constants.FEE.AVATAR_REGISTER)))
                .then((result) => {
                    //Set change address to first utxo's address
                    if (change_address == undefined)
                        change_address = result.utxo[0].address;
                    return Metaverse.transaction_builder.issueDid(result.utxo, avatar_address, symbol, change_address, result.change, bounty_fee, this.globals.network, messages);
                })
                .then((tx) => wallet.sign(tx)))
            .catch((error) => {
                console.error(error)
                throw Error(error.message);
            })
    }

    createRegisterMITTx(passphrase: string, recipient_address: string, recipient_avatar, symbol: string, content: string, change_address: string, fee: number) {
        return this.wallet.getWallet(passphrase)
            .then(wallet => this.getUtxoFrom(recipient_address)
                .then((utxo) => this.getHeight().then(height => Metaverse.output.findUtxo(utxo, {}, height, fee)))
                .then((result) => {
                    //Set change address to first utxo's address
                    if (change_address == undefined)
                        change_address = result.utxo[0].address;
                    return Metaverse.transaction_builder.registerMIT(result.utxo, recipient_address, recipient_avatar, symbol, content, change_address, result.change, fee)
                })
                .then((tx) => wallet.sign(tx)))
            .catch((error) => {
                console.error(error)
                throw Error(error.message);
            })
    }

    createTransferMITTx(passphrase: string, sender_avatar: string, recipient_address: string, recipient_avatar, symbol: string, fee_address: string, change_address: string, fee: number) {
        return this.wallet.getWallet(passphrase)
            .then(wallet => this.getUtxoFrom(fee_address)
                .then((utxo) => Promise.all([this.getHeight().then(height => Metaverse.output.findUtxo(utxo, {}, height, fee)), this.getUtxo().then(utxo => Metaverse.output.filter(utxo, { type: 'mit', symbol: symbol }))]))
                .then((result) => {
                    var fee_utxo = result[0]
                    var mit_utxo = result[1]
                    if (mit_utxo.length !== 1)
                        throw Error('ERR_FIND_MIT')
                    //Set change address to first utxo's address
                    if (change_address == undefined)
                        change_address = fee_utxo.utxo[0].address;
                    return Metaverse.transaction_builder.transferMIT(fee_utxo.utxo.concat(mit_utxo), sender_avatar, recipient_address, recipient_avatar, symbol, change_address, fee_utxo.change, fee)
                })
                .then((tx) => wallet.sign(tx)))
            .catch((error) => {
                console.error(error)
                throw Error(error.message);
            })
    }

    createIssueAssetTx(passphrase: string, symbol: string, quantity: number, precision: number, issuer: string, description: string, secondaryissue_threshold: number, is_secondaryissue: boolean, issue_address: string, change_address: string, create_new_domain_cert: boolean, use_naming_cert: boolean, bounty_fee: number, attenuation_model: string, mst_mining_model: any) {
        return this.getUtxoFrom(issue_address)
            .then(utxo => {
                return this.wallet.getWallet(passphrase)
                    .then((wallet) => {
                        return this.getHeight().then(height => Metaverse.output.findUtxo(utxo, {}, height, Metaverse.constants.FEE.MST_REGISTER))
                            .then((result) => {
                                //Set change address to first utxo's address
                                if (change_address == undefined)
                                    change_address = result.utxo[0].address;
                                let certs = utxo.filter(output => {
                                    if (use_naming_cert) {
                                        if (output.attachment.type == "asset-cert" && output.attachment.symbol == symbol && ['naming'].indexOf(output.attachment.cert) !== -1) {
                                            return true;
                                        }
                                        return false;
                                    } else {
                                        if (!use_naming_cert && output.attachment.type == "asset-cert" && output.attachment.symbol == symbol.split('.')[0] && output.attachment.cert == 'domain')
                                            return true;
                                        else if (output.attachment.type == "asset-cert" && output.attachment.symbol == symbol && ['naming', 'issue'].indexOf(output.attachment.cert) !== -1)
                                            return true;
                                        return false;
                                    }
                                })
                                return Metaverse.transaction_builder.issueAsset(result.utxo.concat(certs), issue_address, symbol, quantity, precision, issuer, description, secondaryissue_threshold, is_secondaryissue, change_address, result.change, create_new_domain_cert, bounty_fee, this.globals.network, attenuation_model, mst_mining_model)
                            })
                            .then((tx) => wallet.sign(tx))
                    })
            })
            .catch((error) => {
                console.error(error)
                throw Error(error.message);
            })
    }

    getNamingCert(symbol) {

    }

    validAddress = (address: string) => {
        if (address.length != 34)
            return false
        let valid = false
        switch (address.charAt(0)) {
            case this.globals.ADDRESS_PREFIX_MAINNET:
                valid = this.globals.network == "mainnet"
                break
            case this.globals.ADDRESS_PREFIX_TESTNET:
                valid = this.globals.network == "testnet"
                break
            case this.globals.ADDRESS_PREFIX_P2SH:
                valid = true
        }
        return valid
    }

    updateHeight() {
        return this.blockchain.height()
            .then((height: number) => this.setHeight(height))
            .then(() => this.getHeight())
    }

    getUtxo() {
        return this.getTxs()
            .then((txs: Array<any>) => txs.sort(function (a, b) {
                return b.height - a.height;
            }))
            .then((txs: Array<any>) => this.getAddresses()
                .then((addresses: Array<string>) => Metaverse.output.calculateUtxo(txs, addresses)));
    }

    getUtxoFrom(address: any) {
        return this.getUtxo()
            .then((utxo: Array<any>) => {
                if (address) {
                    let result = [];
                    if (utxo.length) {
                        utxo.forEach((output) => {
                            if (output.address == address) result.push(output)
                        })
                    }
                    return result;
                } else {
                    return utxo;
                }
            })
    }

    getUtxoFromMultisig(address: any) {
        return this.getTxs()
            .then((txs: Array<any>) => txs.sort(function (a, b) {
                return b.height - a.height;
            }))
            .then((txs: Array<any>) => Metaverse.output.calculateUtxo(txs, [address]));
    }

    listAvatars() {
        return this.getUtxo()
            .then((outputs) => this.blockchain.avatar.extract(outputs))
    }

    listCerts() {
        return this.getUtxo()
            .then((outputs) => Metaverse.output.filter(outputs, { type: "asset-cert" }))
    }

    getGlobalAvatar = (symbol) => this.blockchain.avatar.get(symbol)

    getGlobalMit = (symbol) => this.blockchain.MIT.get(symbol)

    getListMst = () => this.blockchain.MST.list()

    getListMit = () => this.blockchain.MIT.list()

    getBaseCurrency = () => this.storage.get('base')
        .then(base => (base) ? base : 'USD')

    setBaseCurrency = (currency) => this.storage.set('base', currency).then(() => this.event.publish('currency_changes', currency))

    getBalances() {
        return this.storage.get('balances')
            .then((balances: any) => {
                let b = JSON.parse(JSON.stringify(this.DEFAULT_BALANCES));
                if (balances) {
                    if (balances.ETP)
                        b.ETP = balances.ETP;
                    if (balances.MST)
                        Object.keys(balances.MST).forEach((symbol) => {
                            b.MST[symbol] = balances.MST[symbol];
                        })
                    if (balances.MIT)
                        b.MIT = balances.MIT
                }
                return b;
            })
    }

    loadNewTxs(addresses: Array<string>, start: number) {
        return this.blockchain.addresses.listTxs(addresses, { min_height: start })
            .catch(error => {
                console.log('error loading transactions')
                throw (error.message)
            })
    }

    getAddressBalances() {
        return this.storage.get('addressbalances')
    }

    setAddressBalances(balances) {
        return this.storage.set('addressbalances', balances)
    }

    setBalances(newBalances) {
        return this.getBalances()
            .then((balances) => {
                //Check if balance has been changed
                let nb = JSON.parse(JSON.stringify(this.DEFAULT_BALANCES));
                Object.keys(newBalances).forEach((asset) => {
                    nb[asset] = newBalances[asset];
                })
                if (JSON.stringify(balances) != JSON.stringify(nb)) {
                    return this.storage.set('balances', newBalances)
                }
            })
    }

    async getData(): Promise<any> {
        const addresses = await this.getAddresses()
        addresses.concat(await this.wallet.getMultisigAddresses())
        let newTxs = await this.getNewTxs(addresses, await this.getLastTxHeight())
        while (newTxs && newTxs.length) {
            this.event.publish('last_tx_height_update', await this.getLastTxHeight());
            newTxs = await this.getNewTxs(addresses, await this.getLastTxHeight())
        }
        await this.calculateBalances()
        return await this.getBalances()
    }

    async getUpdateNeeded(update_interval = this.globals.update_interval) {
        const lastUpdateTime = await this.getUpdateTime()
        return typeof lastUpdateTime === 'undefined' || (+(new Date()) - +lastUpdateTime) / 1000 > update_interval
    }

    calculateBalances() {
        return this.getHeight()
            .then(height => this.getAddresses()
                .then(addresses => this.wallet.getMultisigAddresses()
                    .then(multisigAddresses => this.getTxs()
                        .then(txs => Metaverse.output.calculateUtxo(txs, addresses.concat(multisigAddresses)))
                        .then(utxos => Promise.all([
                            this.blockchain.balance.all(utxos, addresses, height),
                            this.blockchain.balance.addresses(utxos, addresses.concat(multisigAddresses), height)
                        ]))
                        .then((balances) => Promise.all([
                            this.setBalances(balances[0]),
                            this.setAddressBalances(balances[1])
                        ]))
                    )))
    }

    async getFrozenOutputs(asset) {
        let addresses = await this.getAddresses()
        let transactions = await this.getTxs()
        let outputs = []
        transactions.forEach(tx => {
            tx.outputs.forEach((output) => {
                if (asset == 'ETP' && output.locked_height_range > 0 && output.height && addresses.indexOf(output.address) !== -1) {
                    output.locked_until = (output.locked_height_range) ? tx.height + output.locked_height_range : 0
                    delete output['locked_height_range']
                    output.hash = tx.hash
                    outputs.push(output)
                } else if (asset != 'ETP' && output.attachment && output.attachment.symbol == asset && output.attenuation_model_param && output.attenuation_model_param.lock_period > 0 && output.height && addresses.indexOf(output.address) !== -1) {
                    delete output['locked_height_range']
                    output.hash = tx.hash
                    switch (output.attenuation_model_param.type) {
                        case 1:
                            if (output.attenuation_model_param.current_period_nbr == 0 && output.attenuation_model_param.next_interval == output.attenuation_model_param.lock_period / output.attenuation_model_param.total_period_nbr) {
                                output.locked_until = (output.attenuation_model_param && output.attenuation_model_param.lock_period) ? tx.height + output.attenuation_model_param.lock_period : 0
                                outputs.push(output)
                            }
                            break;
                        case 2:
                        case 3:
                            if (output.attenuation_model_param.current_period_nbr == 0 && output.attenuation_model_param.next_interval == output.attenuation_model_param.locked[0].number) {
                                output.locked_until = (output.attenuation_model_param && output.attenuation_model_param.lock_period) ? tx.height + output.attenuation_model_param.lock_period : 0
                                outputs.push(output)
                            }
                            break;
                    }
                }
            })
        })
        return outputs
    }

    setUpdateTime(lastupdate = undefined) {
        if (lastupdate == undefined)
            lastupdate = new Date()
        return this.storage.set('last_update', lastupdate)
    }

    getUpdateTime() {
        return this.storage.get('last_update')
    }

    setHeight(height) {
        return this.storage.set('mvs_height', height)
    }

    getHeight() {
        return this.storage.get('mvs_height').then((height) => (height) ? height : 0)
    }

    getLastTxHeight() {
        return this.storage.get('mvs_last_tx_height').then((height) => (height) ? height : 0)
    }

    setLastTxHeight(height) {
        return this.storage.set('mvs_last_tx_height', height);
    }

    getAddresses() {
        return this.storage.get('mvs_addresses')
            .then((addresses) => (addresses) ? addresses : [])
    }

    hardReset() {
        return this.storage.get('theme')
            .then((theme: any) => {
                return this.storage.get('language')
                    .then((language: any) => {
                        return this.storage.get('saved_accounts')
                            .then((saved_accounts: any) => {
                                return this.storage.clear()
                                    .then(() => {
                                        this.event.publish('settings_update', {});
                                        return Promise.all([this.storage.set('language', language), this.storage.set('theme', theme), this.storage.set('saved_accounts', saved_accounts)]);
                                    })
                            })
                    })
            });
    }

    dataReset() {
        console.info('reset data')
        return Promise.all(['mvs_last_tx_height', 'mvs_height', 'utxo', 'last_update', 'addressbalances', 'balances', 'mvs_txs', 'asset_order'].map((key) => this.storage.remove(key)))
    }

    async getNewTxs(addresses: Array<string>, lastKnownHeight: number): Promise<any> {
        const newTxs = await this.loadNewTxs(addresses, lastKnownHeight + 1)
        return this.addTxs(newTxs)
    }

    getDbVersion() {
        return this.storage.get('db_version')
    }

    setDbVersion(version) {
        return this.storage.set('db_version', version)
            .then(() => this.getDbVersion())
    }

    getDbUpdateNeeded(): any {
        return this.getDbVersion()
            .then(version => {
                if (version && this.globals.db_version === version)
                    return false
                return this.globals.db_version
            })
    }

    getTxs() {
        return this.storage.get('mvs_txs')
            .then((txs) => (txs) ? txs : [])
    }

    addAddresses(addresses: Array<string>) {
        return this.getAddresses()
            .then((addr: Array<string>) => this.storage.set('mvs_addresses', addr.concat(addresses)))
            .then(() => this.getAddresses())
            .then(() => this.event.publish('settings_update', {}))
    }

    setAddresses(addresses: Array<string>) {
        return this.storage.set('mvs_addresses', addresses)
            .then(() => this.getAddresses())
            .then(() => this.event.publish('settings_update', {}))
    }

    async addTxs(newtxs: Array<any>) {
        if (newtxs === undefined || newtxs.length === 0) {
            return newtxs
        }
        let txs = await this.getTxs()
        newtxs = newtxs.sort((a: any, b: any) => a.height - b.height)
        newtxs.forEach((newtx) => {
            let found = this.findTxIndexByHash(txs, newtx.hash)
            if (found == -1) {
                txs = [newtx].concat(txs)
            } else {
                txs[found] = newtx;
            }
        })
        await this.storage.set('mvs_txs', txs)
        await this.setLastTxHeight(txs[0].height)

        return newtxs
    }

    private findTxIndexByHash(txs, hash) {
        txs.forEach((tx, index) => {
            if (tx.hash === hash) {
                return index
            }
        })
        return -1
    }

    getTickers = () => {
        return this.blockchain.pricing.tickers();
    }

    assetOrder() {
        return this.storage.get('asset_order')
            .then((_: string[]) => {
                if (_)
                    return _
                else {
                    return this.getBalances().then((balances: any) => {
                        let order: string[] = Object.keys(balances.MST)
                        return this.setAssetOrder(order);
                    })
                }
            })
    }

    setAssetOrder(orderList) {
        return this.storage.set('asset_order', orderList)
            .then(() => this.assetOrder())
    }

    async addAssetsToAssetOrder(names: string[]) {
        let order = await this.assetOrder()
        names.forEach(symbol => {
            if (order.indexOf(symbol) === -1)
                order.push(symbol)
        })
        return await this.setAssetOrder(order)
    }

    send = async (tx) => {
        tx.hash = (await this.broadcast(tx.encode().toString('hex'))).hash
        tx.height = await this.getHeight()
        tx.unconfirmed = true
        let balances = await this.getBalances()
        tx.outputs.forEach((output, index) => {
            output.index = index
            output.locked_height_range = (output.locktime) ? output.locktime : 0
            output.locked_until = (output.locktime) ? tx.height + output.locked_height_range : 0
            switch (output.attachment.type) {
                case Metaverse.constants.ATTACHMENT.TYPE.MST:
                    switch (output.attachment.status) {
                        case Metaverse.constants.MST.STATUS.REGISTER:
                            output.attachment.type = 'asset-issue';
                            break;
                        case Metaverse.constants.MST.STATUS.TRANSFER:
                            output.attachment.type = 'asset-transfer';
                            if (balances && balances.MST && balances.MST[output.attachment.symbol])
                                output.attachment.decimals = balances.MST[output.attachment.symbol].decimals
                            break;
                    }
                    break;
                case Metaverse.constants.ATTACHMENT.TYPE.MIT:
                    output.attachment.type = 'mit';
                    break;
                case Metaverse.constants.ATTACHMENT.TYPE.ETP_TRANSFER:
                    output.attachment.type = 'etp';
                    output.attachment.symbol = 'ETP';
                    output.attachment.decimals = 8;
                    break;
            }
        })
        return this.addTxs([tx])
            .then(() => this.getData())
            .then(() => tx)

    }

    broadcast(rawtx: string, max_fee: number = undefined) {
        return this.blockchain.transaction.broadcast(rawtx)
    }

    suggestAvatar(prefix) {
        return this.blockchain.suggest.avatar(prefix)
    }

    suggestAddress(prefix) {
        return this.blockchain.suggest.address(prefix)
    }

    getdictionary(lang) {
        return Metaverse.wallet.wordlists[lang]
    }

    checkmnemonic(mnemonic, wordlist) {
        return Metaverse.wallet.validateMnemonic(mnemonic, wordlist)
    }

    verifyMessageSize(message) {
        return Metaverse.message.size(message)
    }

    getWhitelist() {
        return this.storage.get('eth_swap')
            .then((eth_swap) => {
                let current_time = new Date();
                if (!eth_swap || !eth_swap.whitelist || eth_swap.last_update == undefined || current_time.getTime() - eth_swap.last_update.getTime() > 3600000) {
                    return this.blockchain.bridge.whitelist()
                        .then((whitelist) => {
                            this.setWhitelist(whitelist, current_time)
                            return whitelist
                        })
                } else {
                    return eth_swap.whitelist
                }
            })
            .catch((error) => {
                console.error(error)
                throw Error('ERR_GET_WHITELIST')
            })
    }

    setWhitelist(whitelist, current_time) {
        var eth_swap = {};
        eth_swap['whitelist'] = whitelist
        eth_swap['last_update'] = current_time
        return this.storage.set('eth_swap', eth_swap)
    }

    getBlocktime(current_height) {
        let downscale = 10;
        return this.storage.get('blocktime')
            .then((blocktime) => {
                if (blocktime == undefined || blocktime.height == undefined || current_height > blocktime.height + 1000) {
                    return this.blockchain.block.blocktime(downscale)
                        .then((time) => {
                            this.setBlocktime(time, current_height)
                            return time
                        })

                } else {
                    return blocktime.time
                }
            })
            .catch((error) => {
                console.error(error)
                throw Error('ERR_GET_BLOCKTIME')
            })
    }

    setBlocktime(time, height) {
        var blocktime = {};
        blocktime['time'] = time
        blocktime['height'] = height
        return this.storage.set('blocktime', blocktime)
    }


    addMultisigWallet(wallet) {
        return this.blockchain.multisig.add(wallet)
    }

    getMultisigWallet(address) {
        return this.blockchain.multisig.get(address)
    }

    async decodeTx(rawtx) {
        let transactions = await this.getTxs()
        let tx = Metaverse.transaction.decode(rawtx);
        tx.inputs.forEach(input => {
            let found = false
            transactions.forEach(t => {
                if (input.previous_output.hash == t.hash) {
                    found = true
                    input.previous_output.script = t.outputs[input.previous_output.index].script
                    input.previous_output.address = t.outputs[input.previous_output.index].address
                    input.previous_output.value = t.outputs[input.previous_output.index].value
                    input.previous_output.attachment = t.outputs[input.previous_output.index].attachment
                }
            })
            if (!found) throw `Error finding previous output script for ${input.previous_output.hash}-${input.previous_output.index}`
        })
        return tx
    }

}
