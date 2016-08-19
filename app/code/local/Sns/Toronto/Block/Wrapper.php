<?php
/**
 * Magento
 *
 * NOTICE OF LICENSE
 *
 * This source file is subject to the Open Software License (OSL 3.0)
 * that is bundled with this package in the file LICENSE.txt.
 * It is also available through the world-wide-web at this URL:
 * http://opensource.org/licenses/osl-3.0.php
 * If you did not receive a copy of the license and are unable to
 * obtain it through the world-wide-web, please send an email
 * to license@magentocommerce.com so we can send you a copy immediately.
 *
 * DISCLAIMER
 *
 * Do not edit or add to this file if you wish to upgrade Magento to newer
 * versions in the future. If you wish to customize Magento for your
 * needs please refer to http://www.magentocommerce.com for more information.
 *
 * @category    Mage
 * @package     Mage_Page
 * @copyright   Copyright (c) 2014 Magento Inc. (http://www.magentocommerce.com)
 * @license     http://opensource.org/licenses/osl-3.0.php  Open Software License (OSL 3.0)
 */

/**
 * A generic wrapper block that renders its children and supports a few parameters of the wrapper HTML-element
 */
class Sns_Toronto_Block_Wrapper extends Mage_Page_Block_Html_Wrapper
{
    /**
     * Whether block should render its content if there are no children (no)
     * @var bool
     */
    protected $_dependsOnChildren = true;

    /**
     * Render the wrapper element html
     * Supports different optional parameters, set in data by keys:
     * - element_tag_name (div by default)
     * - element_id
     * - element_class
     * - element_other_attributes
     *
     * Renders all children inside the element.
     *
     * @return string
     */
    protected function _toHtml() {
        if(empty($this->_children)) {
        	$html = '';
        } else {
        	$html = (trim($this->getChildHtml('', true, true))) ? trim($this->getChildHtml('', true, true)) : '';
        }

        if ($this->_dependsOnChildren && empty($html)) {
            return '';
        }
        $_html = '';
		if($this->hasContainer() && $this->getContainer() == 1) $_html .= '<div class="container">';
			if($this->hasWrap() && $this->hasWrapend()) $_html .= $this->getWrap();
				if($this->hasRow() && $this->getRow() == 1) $_html .= '<div class="row">';
					$_html .= $html;
				if($this->hasRow() && $this->getRow() == 1) $_html .= '</div>';
			if($this->hasWrap() && $this->hasWrapend()) $_html .= $this->getWrapend();
		if($this->hasContainer() && $this->getContainer() == 1) $_html .= '</div>';
			
        if ($this->_isInvisible()) {
            return $_html;
        }
        $id          = $this->hasId() ? sprintf(' id="%s"', $this->getId()) : '';
        $class       = $this->hasClass() ? sprintf(' class="%s"', $this->getClass()) : '';
        $params = $this->hasParams() ? ' ' . $this->getParams() : '';
        return sprintf('<%1$s%2$s%3$s%4$s>%5$s</%1$s>', $this->getTagName(), $id, $class, $params, $_html);
    }

    /**
     * Wrapper element tag name getter
     * @return string
     */
    public function getTagName()
    {
        $tagName = $this->getTag();
        return $tagName ? $tagName : 'div';
    }

    /**
     * Setter whether this block depends on children
     * @param $depends
     * @return Mage_Page_Block_Html_Wrapper
     */
    public function dependsOnChildren($depends = '0')
    {
        $this->_dependsOnChildren = (bool)(int)$depends;
        return $this;
    }

    /**
     * Whether the wrapper element should be eventually rendered
     * If it becomes "invisible", the behaviour will be somewhat similar to core/text_list
     *
     * @return bool
     */
    protected function _isInvisible()
    {
        if (!$this->hasMayBeInvisible()) {
            return false;
        }
        foreach ($this->_children as $child) {
            if ($child->hasWrapperMustBeVisible()) {
                return false;
            }
        }
        return true;
    }
}
