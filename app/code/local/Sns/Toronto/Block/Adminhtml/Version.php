<?php
class Sns_Toronto_Block_Adminhtml_Version extends Mage_Adminhtml_Block_System_Config_Form_Field {
	protected function _getElementHtml(Varien_Data_Form_Element_Abstract $element) { 
		return '<strong>'.Mage::helper('toronto')->getThemeVersion().'</strong>. If your version is older, please see changelog.txt file in the download package to update'; 
	} 
}
?>