import React from 'react';
import Switch from 'react-switch';
import Base from '../components/base';
import Field from '../components/field';
import ItemHeader from '../components/itemHeader';

type State = {
    useDarkMode: boolean;
}

export default class Account extends Base<{}, State> {
    state: State = {
        useDarkMode: !!localStorage.useDarkMode,
    };

    render() {
        const {useDarkMode} = this.state;

        return (
            <div id='content'>
                <ItemHeader title={['Account', 'Token']} ready={true}></ItemHeader>

                <div className='contentPanel'>
                    <h3>Current User</h3>

                    <Field name='Token'>
                        <pre></pre>
                    </Field>

                    <Field name='Use Dark Mode'>
                        <Switch
                            checked={useDarkMode}
                            onChange={x => this.setDarkMode(x)}
                            uncheckedIcon={false}
                            checkedIcon={false}
                            width={20}
                            height={10}
                        />
                    </Field>
                </div>

                <div className='contentPanel'>
                    <h3>Learn More</h3>
                    <div>Follow Skooner on <a href='https://github.com/skooner-k8s/skooner'>GitHub</a></div>
                </div>

                <div className='contentPanel'>
                    <h3>Special Thanks</h3>
                    <div>Icons made by <a href='https://www.flaticon.com/authors/dave-gandy' title='Dave Gandy'>Dave Gandy</a></div>
                    <div>from <a href='https://www.flaticon.com/' title='Flaticon'>www.flaticon.com</a></div>
                    <div>licensed by <a href='http://creativecommons.org/licenses/by/3.0/' title='Creative Commons BY 3.0'>CC 3.0 BY</a></div>
                </div>
            </div>
        );
    }

    setDarkMode(useDarkMode: boolean) {
        if (useDarkMode) {
            localStorage.useDarkMode = 'true';
        } else {
            delete localStorage.useDarkMode;
        }

        setDarkModeClass();
        this.setState({useDarkMode});
    }
}

function setDarkModeClass() {
    const root = document.body;
    if (!root) return;

    if (localStorage.useDarkMode) {
        root.classList.add('dark-mode');
    } else {
        root.classList.remove('dark-mode');
    }
}

setDarkModeClass();
