// #region 💫 account:imports
import tfa from 'tfa';
import assert from 'assert';
// #endregion 💫

import { UserAccount } from './account';

class UserAccount_Balance extends UserAccount {

    constructor(data) {
        super(data);

        // #region 🔨 account:constructor
        this.balance = 0;
        // #endregion 🔨
    }

    // #region 🔨 account:methods
    credit(amount) {
        this.balance += amount;
    }

    debit(amount) {
        assert(this.balance - amount >= 0, 'Not enough balance');
        this.balance -= amount;
    }

    // #endregion 🔨
}
