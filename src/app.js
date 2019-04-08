(function (document, window, $) {
    'use strict';

    const OrderbookClient = require('./vendor/OrderbookClient');
    const SportCrypt = require('./vendor/lib/SportCrypt');
    const utils = require('./vendor/lib/scUtil');
    const Web3 = require('web3');
    const web3 = new Web3();
    const $table = $('#table').find('tbody');

    web3.setProvider(new web3.providers.HttpProvider('https://mainnet.infura.io/v3/e4a768d3d86a464782ce2d10a3369678'));
    console.log(web3.isConnected() ? 'connected' : 'not connected');

    class Ludka {

        constructor() {
            this.matchList = [];
            this.client = new OrderbookClient({
                WebSocket: window.WebSocket,
                endpoint: 'wss://sportcrypt.com/ws-mainnet/',
                subscriptions: {
                    bulletin: 0,
                    match: 0,
                    chatmsg: 0,
                    'all-orders': false,
                    txstream: 0,
                    vol: 0,
                    'tx-address': '0xcb922adab285944e6f1fb22d406add08f438eb4c',
                    client: 'ludka-0.1.0'
                }
            });
            this.sc = new SportCrypt(web3);
            this.sc.attachContractExisting('0x37304b0ab297f13f5520c523102797121182fb5b');

            this.client.onOrders = this._processOrders.bind(this);
            this.client.connect();
        }

        /**
         * Unpack new orders, make orders batch, check the actual state of orders,
         * finally call the template.
         *
         * @param {Array} newOrders
         * @private
         */
        _processOrders(newOrders) {
            const self = this;

            let orderBatch = [];

            newOrders.forEach(order => {
                let o = utils.unpackOrderStringWithSig(order);
                //console.log(o.hash, o.details.matchId);
                orderBatch.push(o);
            });

            self._checkOrderBatch(orderBatch)
                .then(ordersState => {
                    ordersState.forEach((state, index) => {
                        if (typeof state.status !== 'undefined' && typeof state.amount !== 'undefined' && state.amount.c[0] >= 1500) {
                            self._addMatch(orderBatch[index]);
                        }

                        //console.log(state.orderHash, state.amount, state.status);
                    });
                })
                .then(() => self._template());
        }

        /**
         * Gets match info by its ID.
         *
         * @param matchId
         * @returns {Promise<Object>}
         * @private
         */
        _getMatch(matchId) {
            const self = this;

            return new Promise(resolve => {
                self.client.fetchSingleMatchInfo(matchId, () => {
                    resolve(self.client.matches[0].details);
                });
            });
        }

        /**
         * Checks the actual state of the orders.
         *
         * @param {Array} orderBatch Array of unpacked orders.
         * @returns {Promise<Array>}
         * @private
         */
        _checkOrderBatch(orderBatch) {
            const self = this;

            return new Promise(resolve => {
                self.sc.checkOrderBatch(orderBatch, (_undefined, ordersState) => {
                    resolve(ordersState);
                });
            });
        }

        /**
         * @param {Object} order
         * @private
         */
        _addMatch(order) {
            const self = this;
            const details = self._decodeOrderDetails(order);

            let added = false;

            // if match exists, add order of the match to the orders array
            if (self.matchList.length) {
                self.matchList.forEach((match, index) => {

                    if (details.matchId === match.matchId) {

                        let currOrder = details.orders[0];
                        // if current order amount >= 0.1 ETH and odds are higher then odds of the existing order
                        // add current order and remove existing
                        if (currOrder.direction === match.orders[0].direction) {
                            if (currOrder.price > match.orders[0].price && currOrder.amount >= 0.1) {
                                self.matchList[index].orders[0] = currOrder;
                            }
                        } else if (match.orders.length === 1) {
                            self.matchList[index].orders[1] = currOrder;
                        } else {
                            if (currOrder.price > match.orders[1].price && currOrder.amount >= 0.1) {
                                self.matchList[index].orders[1] = currOrder;
                            }
                        }

                        added = true;
                    }

                });
            }
            // else add new match
            if (!added) {
                self.matchList.push(details);
            }
        }

        /**
         * @param {Object} order
         * @returns {{matchId: *, orders: {contractAddr: *, amount: (number|*), expiry: *, nonce: *, price: (number|*), direction: *, fromAddress: *}[]}}
         * @private
         */
        _decodeOrderDetails(order) {
            let price = this._hexToDec(order.details.price);
            let direction = this._hexToDec(order.details.direction);
            let amount = this._hexToDec(order.details.amount);

            // convert Implied Probability to Decimal Odds depends on direction
            // and round it to at most 3 decimals
            price = Math.round((direction === 0 ? 100 / price : 100 / (100 - price)) * 1000) / 1000;

            // convert amount from Gwei to ETH
            // and round it to at most 3 decimals
            amount = Math.round((amount / (price - 1) / 1000000000000000000) * 1000) / 1000;

            return {
                matchId: order.details.matchId,
                orders: [
                    {
                        contractAddr: order.details.contractAddr,
                        amount: amount,
                        expiry: this._hexToDec(order.details.expiry),
                        nonce: this._hexToDec(order.details.nonce),
                        price: price,
                        direction: direction,
                        fromAddress: order.details.fromAddress
                    }
                ]
            };
        }

        _template() {
            const self = this;
            const processedMatches = [];

            self.matchList.forEach(order => {

                self._getMatch(order.matchId)
                    .then(match => {
                        const details = {
                            type: match.type.split('/'),
                            kickoff: parseInt(match.event.kickoff),
                            date: self._timeConverter(match.event.kickoff),
                            spread: typeof match.event.spread !== 'undefined' ? match.event.spread : '',
                            total: typeof match.event.total !== 'undefined' ? match.event.total : '',
                            team1: match.event.team1,
                            team2: match.event.team2,
                            name: match.event.team1 + ' vs ' + match.event.team2,
                            href: 'https://www.sportcrypt.com/trade/match-trade/' + order.matchId,
                            odds: {
                                0: {
                                    price: '',
                                    amount: ''
                                },
                                1: {
                                    price: '',
                                    amount: ''
                                }
                            }
                        };

                        order.orders.forEach(o => {
                            details.odds[o.direction] = {
                                price: o.price,
                                amount: o.amount
                            }
                        });

                        let eventID = self._hashCode(details.name);

                        const spreads = self._convertSpreads(details);
                        const $event = $('#' + eventID);
                        // unique event ID for duplicated matchlines /w different handicaps and totals
                        const processedMatchId = self._hashCode(details.name + details.type[2]);

                        if ($event.length && processedMatches.indexOf(processedMatchId) === -1) {

                            if (details.spread !== '') {
                                let $pHomeSpread = $event.find('.p-home-spread');
                                let $pAwaySpread = $event.find('.p-away-spread');

                                if ($pHomeSpread.text() === '')
                                    $pHomeSpread.text(spreads.modSpread);
                                if ($pAwaySpread.text() === '')
                                    $pAwaySpread.text(details.spread);

                                $event.find('.home-spread').html(spreads.cryptHomeSpread);
                                $event.find('.away-spread').html(spreads.cryptAwaySpread);
                                $event.next().find('.home-price').text(spreads.homePrice);
                                $event.next().find('.away-price').text(spreads.awayPrice);
                                $event.next().next().find('.home-amount').text(spreads.homeAmount);
                                $event.next().next().find('.away-amount').text(spreads.awayAmount);
                            }

                            if (details.total !== '') {
                                let $pOverTotal = $event.find('.p-over-total');
                                let $pUnderTotal = $event.find('.p-under-total');

                                if ($pOverTotal.text() === '>')
                                    $pOverTotal.text('>' + details.total);
                                if ($pUnderTotal.text() === '<')
                                    $pUnderTotal.text('<' + details.total);

                                $event.find('.over-total').html('>' + spreads.cryptTotal);
                                $event.find('.under-total').html('<' + spreads.cryptTotal);
                                $event.next().find('.over-price').text(spreads.overPrice);
                                $event.next().find('.under-price').text(spreads.underPrice);
                                $event.next().next().find('.over-amount').text(spreads.overAmount);
                                $event.next().next().find('.under-amount').text(spreads.underAmount);
                            }

                        } else {
                            let $events = $table.find('.event');
                            // unique event ID for duplicated matchlines
                            if ($event.length) {
                                eventID = processedMatchId;
                            }

                            let event = (
                                '<tr class="event" id="' + eventID + '" data-time="' + details.kickoff + '">' +
                                '<th scope="row" rowspan="3">' + details.date + '</th>' +
                                '<th class="type" scope="row" rowspan="3">' + details.type[1].toUpperCase() + '</th>' +
                                '<th class="team1" scope="row" rowspan="3">' + details.team1 + '</th>' +
                                '<th class="team2" scope="row" rowspan="3">' + details.team2 + '</th>' +
                                '<th class="home-spread">' + spreads.cryptHomeSpread + '</th>' +
                                '<th class="away-spread">' + spreads.cryptAwaySpread + '</th>' +
                                '<th class="over-total">>' + spreads.cryptTotal + '</th>' +
                                '<th class="under-total"><' + spreads.cryptTotal + '</th>' +
                                '<th class="p-home-spread">' + spreads.modSpread + '</th>' +
                                '<th class="p-away-spread">' + details.spread + '</th>' +
                                '<th class="p-over-total">>' + details.total + '</th>' +
                                '<th class="p-under-total"><' + details.total + '</th>' +
                                '</tr>' +

                                '<tr>' +
                                '<td class="home-price">' + spreads.homePrice + '</td>' +
                                '<td class="away-price">' + spreads.awayPrice + '</td>' +
                                '<td class="over-price">' + spreads.overPrice + '</td>' +
                                '<td class="under-price">' + spreads.underPrice + '</td>' +
                                '<td class="p-home-price">-</td>' +
                                '<td class="p-away-price">-</td>' +
                                '<td class="p-over-price">-</td>' +
                                '<td class="p-under-price">-</td>' +
                                '</tr>' +

                                '<tr>' +
                                '<td class="home-amount">' + spreads.homeAmount + '</td>' +
                                '<td class="away-amount">' + spreads.awayAmount + '</td>' +
                                '<td class="over-amount">' + spreads.overAmount + '</td>' +
                                '<td class="under-amount">' + spreads.underAmount + '</td>' +
                                '<td>-</td>' +
                                '<td>-</td>' +
                                '<td>-</td>' +
                                '<td>-</td>' +
                                '</tr>'
                            );

                            let added = false;

                            if ($events.length) {
                                $events.each((i, e) => {
                                    if (details.kickoff < parseInt($(e).data('time'))) {
                                        $(e).before(event);
                                        added = true;
                                        return false;
                                    }
                                });
                            }

                            if (!added) {
                                $table.append(event);
                            }
                        }

                        processedMatches.push(processedMatchId);
                    });

            });
        }

        _hexToDec(hex) {
            return hex.toLowerCase().split('').reduce((result, ch) =>
                result * 16 + '0123456789abcdefgh'.indexOf(ch), 0);
        }

        _hashCode(str) {
            let hash = 0;

            if (str.length === 0) {
                return hash;
            }

            for (let i = 0; i < str.length; i++) {
                let char = str.charCodeAt(i);

                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
                hash = hash.toString().replace('-', '');
            }

            return hash;
        };

        _timeConverter(UNIX_timestamp) {
            let a = new Date(UNIX_timestamp * 1000);
            let months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
            let year = a.getFullYear();
            let month = months[a.getMonth()];
            let date = a.getDate();
            let hour = a.getHours();
            let min = a.getMinutes().toString();

            if (min.length === 1) {
                min = '0' + min;
            }

            return date + '.' + month + '.' + year + '<br>' + hour + ':' + min;
        }

        _convertSpreads(details) {
            const spreads = {
                modSpread: '',
                cryptHomeSpread: '',
                cryptAwaySpread: '',
                cryptTotal: '',
                homePrice: '',
                awayPrice: '',
                overPrice: '',
                underPrice: '',
                homeAmount: '',
                awayAmount: '',
                overAmount: '',
                underAmount: ''
            };

            if (details.spread !== '') {
                if (/\+/.test(details.spread)) {
                    spreads.modSpread = '-' + details.spread.substring(1);
                } else {
                    spreads.modSpread = '+' + details.spread.substring(1);
                }
                spreads.cryptHomeSpread = '<a href="' + details.href + '" target="_blank">' + spreads.modSpread + '</a>';
                spreads.cryptAwaySpread = '<a href="' + details.href + '" target="_blank">' + details.spread + '</a>';
                spreads.homePrice = details.odds[0].price;
                spreads.awayPrice = details.odds[1].price;
                spreads.homeAmount = details.odds[0].amount;
                spreads.awayAmount = details.odds[1].amount;
            }

            if (details.total !== '') {
                spreads.cryptTotal = '<a href="' + details.href + '" target="_blank">' + details.total + '</a>';
                spreads.overPrice = details.odds[0].price;
                spreads.underPrice = details.odds[1].price;
                spreads.overAmount = details.odds[0].amount;
                spreads.underAmount = details.odds[1].amount;
            }

            return spreads;
        }

        _getPinnacle() {
            return new Promise(resolve => {
                const $events = $table.find('.event');
                const data = {};

                $events.each((index, event) => {
                    data[index] = {};
                    data[index]['id'] = $(event).attr('id');
                    data[index]['type'] = $(event).find('.type').text().toLowerCase();
                    data[index]['team1'] = $(event).find('.team1').text();
                    data[index]['team2'] = $(event).find('.team2').text();
                    data[index]['spread1'] = $(event).find('.p-home-spread').text();
                    data[index]['spread2'] = $(event).find('.p-away-spread').text();
                    data[index]['total'] = $(event).find('.p-over-total').text().substr(1);
                });

                $.post(
                    'ajax/parse.php', data, (response) => {
                        resolve(response);
                    });
            });
        }
    }

    const ludka = new Ludka();

    $('#update').on('click', () => {
        let $loader = $('.loader');

        $loader.show();

        $('.home-price').removeClassStartingWith('bg-');
        $('.away-price').removeClassStartingWith('bg-');
        $('.over-price').removeClassStartingWith('bg-');
        $('.under-price').removeClassStartingWith('bg-');

        $('.p-home-price').removeClassStartingWith('bg-').html('');
        $('.p-away-price').removeClassStartingWith('bg-').html('');
        $('.p-over-price').removeClassStartingWith('bg-').html('');
        $('.p-under-price').removeClassStartingWith('bg-').html('');

        ludka._getPinnacle()
            .then(pinnacle => {
                pinnacle = JSON.parse(pinnacle);
                pinnacle.forEach(event => {
                    if (event) {
                        event = JSON.parse(event);
                        console.log(event);
                        const $event = $('#' + event.id);
                        const $row = $event.next();
                        const $hSpread = $event.find('.p-home-spread');
                        const $aSpread = $event.find('.p-away-spread');
                        const $oTotal = $event.find('.p-over-total');
                        const $uTotal = $event.find('.p-under-total');
                        const a = '<a href="' + event.uri + '" target="_blank">';

                        const $elem = {
                            home: $row.find('.home-price'),
                            away: $row.find('.away-price'),
                            over: $row.find('.over-price'),
                            under: $row.find('.under-price'),
                            p_home: $row.find('.p-home-price'),
                            p_away: $row.find('.p-away-price'),
                            p_over: $row.find('.p-over-price'),
                            p_under: $row.find('.p-under-price')
                        };

                        const odds = {
                            home: parseFloat($elem.home.text()),
                            away: parseFloat($elem.away.text()),
                            over: parseFloat($elem.over.text()),
                            under: parseFloat($elem.under.text()),
                            p_home: parseFloat(event.spread1),
                            p_away: parseFloat(event.spread2),
                            p_over: parseFloat(event.totalOver),
                            p_under: parseFloat(event.totalUnder)
                        };

                        let margin = event.margin;

                        const dif = {
                            home: (1 / odds.p_home - margin / odds.p_home) * odds.home,
                            away: (1 / odds.p_away - margin / odds.p_away) * odds.away,
                            over: (1 / odds.p_over - margin / odds.p_over) * odds.over,
                            under: (1 / odds.p_under - margin / odds.p_under) * odds.under,
                        };

                        $hSpread.html(a + $hSpread.text() + '</a>');
                        $aSpread.html(a + $aSpread.text() + '</a>');
                        $oTotal.html(a + $oTotal.text() + '</a>');
                        $uTotal.html(a + $uTotal.text() + '</a>');

                        if (event.spread1) {
                            $elem.p_home.text(event.spread1);
                        } else {
                            $elem.p_home.addClass('bg-secondary').text('★');
                        }

                        if (event.spread2) {
                            $elem.p_away.text(event.spread2);
                        } else {
                            $elem.p_away.addClass('bg-secondary').text('★');
                        }

                        if (event.totalOver) {
                            $elem.p_over.text(event.totalOver);
                        } else {
                            $elem.p_over.addClass('bg-secondary').text('★');
                        }

                        if (event.totalUnder) {
                            $elem.p_under.text(event.totalUnder);
                        } else {
                            $elem.p_under.addClass('bg-secondary').text('★');
                        }

                        Object.keys(dif).forEach(key => {
                            if (dif[key] > 1.05) {
                                $elem[key].addClass('bg-gold');
                                $elem['p_' + key].addClass('bg-gold');
                            } else if (dif[key] > 1.02) {
                                $elem[key].addClass('bg-success');
                                $elem['p_' + key].addClass('bg-success');
                            } else if (dif[key] > 1) {
                                $elem[key].addClass('bg-info');
                                $elem['p_' + key].addClass('bg-info');
                            } else {
                                $elem[key].removeClass('bg-info', function (index, className) {
                                    return className.replace(/(^|\s)bg-\S+/g, '');
                                });
                                $elem['p_' + key].removeClass('bg-info', function (index, className) {
                                    return className.replace(/(^|\s)bg-\S+/g, '');
                                });
                            }
                        });
                    }

                    $loader.hide();
                })
            });
    });

    $.fn.removeClassStartingWith = function (filter) {
        $(this).removeClass(function (index, className) {
            return (className.match(new RegExp("\\S*" + filter + "\\S*", 'g')) || []).join(' ')
        });

        return this;
    };

})(document, window, jQuery);